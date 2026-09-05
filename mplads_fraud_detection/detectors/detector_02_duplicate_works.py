"""
Detector 2: Duplicate Works (Semantic NLP & Embeddings)
Catches reworded, paraphrased, and multi-funded projects using Transformer embeddings and Union-Find clustering.
"""

import os
import pickle
import logging
from typing import Dict, List, Tuple, Set
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly, ReviewQueueItem
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import (
    SEVERITY_FLOOR, EMBEDDINGS_CACHE_FILE, SENTENCE_TRANSFORMER_MODEL, FALLBACK_TRANSFORMER_MODEL
)

logger = logging.getLogger(__name__)


class UnionFind:
    """Disjoint Set Union (Union-Find) with path compression and union-by-rank."""
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int):
        root_x = self.find(x)
        root_y = self.find(y)
        if root_x == root_y:
            return
        if self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        elif self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1


def get_text_embeddings(descriptions: List[str], work_ids: List[int]) -> np.ndarray:
    """
    Generates text embeddings using multilingual Sentence Transformers with local disk caching and fallback.
    """
    # Load cache if available
    cache = {}
    if os.path.exists(EMBEDDINGS_CACHE_FILE):
        try:
            with open(EMBEDDINGS_CACHE_FILE, "rb") as f:
                cache = pickle.load(f)
        except Exception:
            cache = {}

    missing_indices = [i for i, wid in enumerate(work_ids) if wid not in cache]
    
    if missing_indices:
        # Prepend passage: prefix required by E5 models
        prefixed_texts = [f"passage: {descriptions[i]}" for i in missing_indices]
        
        try:
            from sentence_transformers import SentenceTransformer
            try:
                model = SentenceTransformer(SENTENCE_TRANSFORMER_MODEL)
            except Exception:
                model = SentenceTransformer(FALLBACK_TRANSFORMER_MODEL)

            new_embeddings = model.encode(
                prefixed_texts,
                batch_size=64,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            for idx, emb in zip(missing_indices, new_embeddings):
                cache[work_ids[idx]] = emb

            # Save updated cache
            os.makedirs(os.path.dirname(EMBEDDINGS_CACHE_FILE), exist_ok=True)
            with open(EMBEDDINGS_CACHE_FILE, "wb") as f:
                pickle.dump(cache, f)

        except Exception as e:
            logger.warning(f"SentenceTransformer embedding failed ({e}). Using robust TF-IDF fallback.")
            tfidf = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=384)
            fallback_embeddings = tfidf.fit_transform(descriptions).toarray()
            return fallback_embeddings

    # Assemble complete embedding matrix
    embeddings_list = [cache[wid] for wid in work_ids]
    return np.array(embeddings_list)


def run_detector_02_duplicate_works(session: Session, run_id: str) -> int:
    """
    Executes Detector 2: Duplicate Works using Semantic Embeddings and Graph Clustering.
    """
    logger.info("Executing Detector 2: Duplicate Works (Semantic NLP)...")

    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "work_description": w.work_description,
        "cost": w.cost,
        "district": w.district,
        "mp_name": w.mp_name,
        "category": w.category,
        "completion_date": str(w.completion_date)
    } for w in works])

    # Filter out very short descriptions (<20 chars) for semantic matching
    df["desc_len"] = df["work_description"].str.len()
    df_valid = df[df["desc_len"] >= 20].copy().reset_index(drop=True)

    if len(df_valid) < 2:
        return 0

    # 1. Identify Mass Boilerplate Descriptions (>10 occurrences across dataset)
    desc_counts = df_valid["work_description"].value_counts()
    boilerplate_templates = set(desc_counts[desc_counts > 10].index)

    # 2. Generate Embeddings
    descriptions = df_valid["work_description"].tolist()
    work_ids = df_valid["work_id"].tolist()
    embeddings = get_text_embeddings(descriptions, work_ids)

    id_to_idx = {wid: idx for idx, wid in enumerate(work_ids)}
    n_works = len(df_valid)
    uf = UnionFind(n_works)

    high_confidence_pairs = []
    review_queue_items = []

    # 3. District-Partitioned Pairwise Cosine Similarity
    districts = df_valid["district"].unique()
    for dist in districts:
        dist_indices = df_valid[df_valid["district"] == dist].index.tolist()
        n_dist = len(dist_indices)
        if n_dist < 2:
            continue

        dist_embeddings = embeddings[dist_indices]
        sim_matrix = cosine_similarity(dist_embeddings)

        pair_i, pair_j = np.where(np.triu(sim_matrix >= 0.85, k=1))
        for i, j in zip(pair_i, pair_j):
            sim = float(sim_matrix[i, j])

            idx_a, idx_b = dist_indices[i], dist_indices[j]
            row_a, row_b = df_valid.iloc[idx_a], df_valid.iloc[idx_b]

            # Skip mass boilerplate descriptions from duplicate project pairing
            desc_a = row_a["work_description"]
            desc_b = row_b["work_description"]
            if desc_a in boilerplate_templates or desc_b in boilerplate_templates:
                continue

            same_category = (row_a["category"] == row_b["category"])
            same_mp = (row_a["mp_name"] == row_b["mp_name"])
            cost_ratio = safe_divide(row_b["cost"], row_a["cost"], fill=1.0)
            similar_cost = (0.70 <= cost_ratio <= 1.43)

            wid_a, wid_b = int(row_a["work_id"]), int(row_b["work_id"])
            canonical_a, canonical_b = min(wid_a, wid_b), max(wid_a, wid_b)

            # Rule A: Highly Similar Project (+ same category + similar cost band) or Identical Text (>= 0.95)
            if (sim >= 0.93 and same_category and similar_cost) or (sim >= 0.95):
                uf.union(idx_a, idx_b)
                high_confidence_pairs.append({
                    "work_id_a": canonical_a,
                    "work_id_b": canonical_b,
                    "similarity": sim,
                    "same_mp": same_mp,
                    "same_district": True,
                    "cost_a": float(row_a["cost"]),
                    "cost_b": float(row_b["cost"])
                })
            elif 0.88 <= sim < 0.93 and same_mp and same_category and similar_cost:
                # Rule C: Route borderline pairs to review_queue (high-precision: same MP, category, cost band)
                review_queue_items.append(ReviewQueueItem(
                    work_id_a=canonical_a,
                    work_id_b=canonical_b,
                    detector_type="duplicate_work",
                    similarity=round(sim, 3),
                    reason=f"Borderline similarity ({sim*100:.1f}%) across '{row_a['category']}' works in {dist}",
                    status="PENDING",
                    run_id=run_id
                ))

    # 4. Cluster Extraction & Validation (Genuine duplicate clusters: 2 to 10 works)
    clusters = {}
    for idx, wid in enumerate(work_ids):
        root = uf.find(idx)
        if root not in clusters:
            clusters[root] = []
        clusters[root].append(idx)

    # Filter to valid duplicate clusters of size between 2 and 10
    dup_clusters = [indices for indices in clusters.values() if 2 <= len(indices) <= 10]

    anomalies_to_insert = []
    for cluster_num, indices in enumerate(dup_clusters, start=1):
        cluster_work_ids = [int(df_valid.iloc[i]["work_id"]) for i in indices]
        cluster_rows = df_valid.iloc[indices]
        cluster_size = len(indices)

        # Compute cluster pairwise similarities
        cluster_embs = embeddings[indices]
        c_sim_matrix = cosine_similarity(cluster_embs)
        upper_sims = [float(c_sim_matrix[i, j]) for i in range(cluster_size) for j in range(i + 1, cluster_size)]
        avg_sim = float(np.mean(upper_sims)) if upper_sims else 0.90

        same_mp_all = (cluster_rows["mp_name"].nunique() == 1)
        cluster_id_str = f"DUP_CLUSTER_{cluster_num:03d}"

        # Base Severity calculation
        base_sev = monotonic_severity(avg_sim, [0.85, 1.00], [0.50, 1.00])
        cluster_severity = base_sev + (0.10 if same_mp_all else 0.0)
        cluster_severity = max(SEVERITY_FLOOR, min(1.0, cluster_severity))

        for idx in indices:
            row = df_valid.iloc[idx]
            current_wid = int(row["work_id"])
            peer_wids = [wid for wid in cluster_work_ids if wid != current_wid]

            explanation = (
                f"Duplicate project cluster detected ({cluster_id_str}): This project is semantically identical "
                f"or highly similar (avg similarity {avg_sim*100:.1f}%) to {len(peer_wids)} peer work(s) "
                f"in {row['district']} (Peer IDs: {', '.join(map(str, peer_wids[:3]))}). "
                f"{'All works funded by the same MP (' + str(row['mp_name']) + ').' if same_mp_all else ''}"
            )

            evidence = {
                "duplicate_cluster_id": cluster_id_str,
                "cluster_size": cluster_size,
                "peer_work_ids": peer_wids,
                "avg_cluster_similarity": round(avg_sim, 3),
                "same_mp": same_mp_all,
                "district": str(row["district"]),
                "mp_name": str(row["mp_name"]),
                "category": str(row["category"]),
                "cost": float(row["cost"]),
                "description_preview": str(row["work_description"])[:120]
            }

            anomaly = Anomaly(
                work_id=current_wid,
                detector_type="duplicate_work",
                severity=round(cluster_severity, 3),
                explanation=explanation,
                evidence=evidence,
                run_id=run_id
            )
            anomalies_to_insert.append(anomaly)

    # Bulk insert anomalies and review queue items
    session.bulk_save_objects(anomalies_to_insert)
    if review_queue_items:
        session.bulk_save_objects(review_queue_items)

    session.flush()
    logger.info(f"Detector 2 generated {len(anomalies_to_insert):,} duplicate anomalies in {len(dup_clusters)} clusters, {len(review_queue_items)} review items.")
    return len(anomalies_to_insert)
