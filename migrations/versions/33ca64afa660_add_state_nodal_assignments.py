"""add_state_nodal_assignments

Revision ID: 33ca64afa660
Revises: aa632f61c531
Create Date: 2026-09-03 23:05:01.608690

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33ca64afa660'
down_revision: Union[str, Sequence[str], None] = 'aa632f61c531'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'state_nodal_assignments',
        sa.Column('user_id', sa.String(length=36), primary_key=True),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.func.now(), nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('state_nodal_assignments')
