# Production Deployment Specification

## 1. Environment Configuration
The platform dynamically switches configuration based on `DEPLOYMENT_ENV`:

```bash
# Local Development (Embedded SQLite with WAL Mode)
export DEPLOYMENT_ENV=development
export DATABASE_URL="sqlite:///mplads_fraud.db"

# Production Environment (PostgreSQL)
export DEPLOYMENT_ENV=production
export DATABASE_URL="postgresql://user:password@host:5432/mplads_db"
```

---

## 2. Production Database Enforcement
When `DEPLOYMENT_ENV=production`:
* PostgreSQL connection pooling is mandatory (`pool_size=10, max_overflow=20, pool_pre_ping=True`).
* SSL encryption is enforced.
* Transactions use row-level locks and ACID snapshot isolation.

---

## 3. Web Dashboard Service
Run the Streamlit application behind Nginx / reverse proxy:
```bash
streamlit run app.py --server.port 8501 --server.address 0.0.0.0
```
