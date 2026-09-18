#!/usr/bin/env python3
"""
Generate web/src/lib/assemblyConstituencies.ts from data/assembly_constituencies_enriched.csv
"""

import json
import pandas as pd

def main():
    df = pd.read_csv("data/assembly_constituencies_enriched.csv")
    
    items = []
    for _, row in df.iterrows():
        ac = str(row.get("ac_name", "")).strip()
        pc = str(row.get("pc_name", "")).strip()
        st = str(row.get("state", "")).strip()
        dist = str(row.get("district", "")).strip()
        mp_name = str(row.get("mp_name", "")).strip()
        mp_id = str(row.get("mp_id", "")).strip()
        
        if not ac:
            continue
            
        items.append({
            "ac": ac,
            "pc": pc,
            "state": st,
            "district": dist,
            "mpName": mp_name,
            "mpId": mp_id
        })
        
    print(f"Loaded {len(items)} items for TypeScript module.")

    ts_content = f"""// Comprehensive Indian Assembly Constituencies (Vidhan Sabha) mapped to Parliamentary Constituencies (Lok Sabha) & sitting MPs.
// Total: {len(items)} Assembly Constituencies across all States and Union Territories.

export interface AssemblyItem {{
  ac: string
  pc: string
  state: string
  district: string
  mpName: string
  mpId: string
}}

export const ASSEMBLY_CONSTITUENCIES: AssemblyItem[] = {json.dumps(items, ensure_ascii=False, indent=2)}

/**
 * Substring / prefix search across Assembly Constituencies
 */
export function findAssemblyConstituencies(query: string, limit = 8): AssemblyItem[] {{
  const q = query.trim().toLowerCase()
  if (!q) return []
  
  const exact: AssemblyItem[] = []
  const starts: AssemblyItem[] = []
  const contains: AssemblyItem[] = []
  
  for (const item of ASSEMBLY_CONSTITUENCIES) {{
    const name = item.ac.toLowerCase()
    if (name === q) {{
      exact.push(item)
    }} else if (name.startsWith(q)) {{
      starts.push(item)
    }} else if (name.includes(q)) {{
      contains.push(item)
    }}
    if (exact.length + starts.length + contains.length >= limit * 2) break
  }}
  
  return [...exact, ...starts, ...contains].slice(0, limit)
}}

/**
 * Exact match for Assembly Constituency name (case-insensitive)
 */
export function findExactAC(acName: string): AssemblyItem[] {{
  const q = acName.trim().toLowerCase()
  if (!q) return []
  return ASSEMBLY_CONSTITUENCIES.filter(item => item.ac.toLowerCase() === q)
}}

/**
 * Retrieve all Assembly Constituencies within a parent Parliamentary Constituency
 */
export function getACsByPC(pcName: string): AssemblyItem[] {{
  const q = pcName.trim().toLowerCase()
  if (!q) return []
  return ASSEMBLY_CONSTITUENCIES.filter(item => item.pc.toLowerCase() === q)
}}

/**
 * Retrieve all Assembly Constituencies within a State
 */
export function getACsByState(stateName: string): AssemblyItem[] {{
  const q = stateName.trim().toLowerCase()
  if (!q) return []
  return ASSEMBLY_CONSTITUENCIES.filter(item => item.state.toLowerCase() === q)
}}
"""

    out_path = "web/src/lib/assemblyConstituencies.ts"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"Generated {out_path} successfully!")

if __name__ == "__main__":
    main()
