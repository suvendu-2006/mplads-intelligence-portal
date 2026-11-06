"""realtime_lifecycle_reauditing

Revision ID: 916dd984c659
Revises: 33ca64afa660
Create Date: 2026-11-06 23:51:33.742020

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '916dd984c659'
down_revision: Union[str, Sequence[str], None] = '33ca64afa660'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("works", schema=None) as batch_op:
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("last_audited_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("lifecycle_audit_version", sa.String(50), server_default="v3.0", nullable=True))
        batch_op.add_column(sa.Column("audit_status", sa.String(30), server_default="PENDING", nullable=True))
        batch_op.create_index("idx_works_district_rec_date", ["district", "recommended_date"])

    with op.batch_alter_table("anomalies", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False))
        batch_op.add_column(sa.Column("resolved_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("resolution_reason", sa.Text(), nullable=True))
        batch_op.create_index("idx_anomalies_work_active_detector", ["work_id", "is_active", "detector_type"])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("anomalies", schema=None) as batch_op:
        batch_op.drop_index("idx_anomalies_work_active_detector")
        batch_op.drop_column("resolution_reason")
        batch_op.drop_column("resolved_at")
        batch_op.drop_column("is_active")

    with op.batch_alter_table("works", schema=None) as batch_op:
        batch_op.drop_index("idx_works_district_rec_date")
        batch_op.drop_column("audit_status")
        batch_op.drop_column("lifecycle_audit_version")
        batch_op.drop_column("last_audited_at")
        batch_op.drop_column("updated_at")
