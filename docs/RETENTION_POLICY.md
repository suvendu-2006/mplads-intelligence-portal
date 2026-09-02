# Data Retention & Disposal Policy

This policy governs the retention, archival, and secure disposal of all data assets, audit logs, model outputs, and backups within the MPLADS Anomaly Screening Platform in compliance with statutory CAG audit norms and administrative guidelines.

---

## 1. Retention Schedule

| Asset Category | Retention Period | Justification | Disposal Method |
|:---|:---|:---|:---|
| **Raw Official Data Sources** | **Indefinite** | Statutory audit evidence & legal reproducibility | Immutable offline archive |
| **Audit Logs & Verification Trails** | **7 Years** | CAG Performance Audit and PAC inquiry cycle requirements | Automated monthly prune after 7-year mark |
| **Model Predictions & Feature Snapshots** | **2 Years** | Temporal drift tracking and retrospective model auditing | Automated purge of retired model versions |
| **Quarantined / Rejected Rows** | **1 Year** | Forensic analysis of upstream MoSPI portal schema drift | Automated rolling purge |
| **User Web Sessions & Tokens** | **24 Hours** | Security best practice; prevents credential replay | Automated hourly cleanup |
| **Encrypted Database Backups** | **30 Days** | Disaster recovery and point-in-time state reconstruction | Automated daily rotation (`find -mtime +30 -delete`) |
| **Model Code & Weights Artifacts** | **All Versions** | Complete algorithmic reproducibility across audit generations | Permanent versioned artifact repository |

---

## 2. Automated Retention Maintenance Script

The retention cleanup routine is implemented in [`mplads_fraud_detection/maintenance/retention.py`](file:///Users/suvendu/Downloads/SIH-DATA/mplads_fraud_detection/maintenance/retention.py) and scheduled to run via cron on the 1st of every month:

```cron
# Run monthly retention purge at 02:00 AM on the 1st of each month
0 2 1 * * /path/to/venv/bin/python -m mplads_fraud_detection.maintenance.retention >> /var/log/mplads_retention.log 2>&1
```
