"""add_performance_indexes

Revision ID: f026387ef39f
Revises: 35fc48c5955e
Create Date: 2026-09-03 00:10:42.777275

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f026387ef39f'
down_revision: Union[str, Sequence[str], None] = '35fc48c5955e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Work query indexes
    op.create_index(
        'idx_works_flagged_lookup',
        'works',
        ['district', 'mp_name', 'completion_date']
    )

    # Anomaly severity queries
    op.create_index(
        'idx_anomalies_severity_detector',
        'anomalies',
        ['severity', 'detector_type', 'run_id']
    )

    # Label review status
    op.create_index(
        'idx_labels_review_status',
        'fraud_labels',
        ['review_status', 'created_at']
    )

    # Source dataset lineage
    op.create_index(
        'idx_works_source_dataset',
        'works',
        ['source_dataset_id', 'ingestion_run_id']
    )


def downgrade() -> None:
    op.drop_index('idx_works_source_dataset', table_name='works')
    op.drop_index('idx_labels_review_status', table_name='fraud_labels')
    op.drop_index('idx_anomalies_severity_detector', table_name='anomalies')
    op.drop_index('idx_works_flagged_lookup', table_name='works')
