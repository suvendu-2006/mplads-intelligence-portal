"""add_dual_review_workflow_to_fraud_labels

Revision ID: aa632f61c531
Revises: f026387ef39f
Create Date: 2026-09-03 00:39:32.353805

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa632f61c531'
down_revision: Union[str, Sequence[str], None] = 'f026387ef39f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('label_history',
        sa.Column('history_id', sa.String(length=36), nullable=False),
        sa.Column('label_id', sa.String(length=50), nullable=False),
        sa.Column('previous_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('changed_by', sa.String(length=36), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by'], ['users.user_id'], ),
        sa.ForeignKeyConstraint(['label_id'], ['fraud_labels.label_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('history_id')
    )
    op.create_index(op.f('ix_label_history_label_id'), 'label_history', ['label_id'], unique=False)

    with op.batch_alter_table('fraud_labels') as batch_op:
        batch_op.add_column(sa.Column('auditor_user_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('submitted_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('verified_by', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('verified_by_user_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('verified_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('evidence_document_path', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('evidence_checksum_sha256', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('confidence_score', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rejection_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('rejected_by', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('rejected_by_user_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('rejected_at', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_fraud_labels_auditor_user_id', 'users', ['auditor_user_id'], ['user_id'])
        batch_op.create_foreign_key('fk_fraud_labels_verified_by_user_id', 'users', ['verified_by_user_id'], ['user_id'])
        batch_op.create_foreign_key('fk_fraud_labels_rejected_by_user_id', 'users', ['rejected_by_user_id'], ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('fraud_labels') as batch_op:
        batch_op.drop_constraint('fk_fraud_labels_rejected_by_user_id', type_='foreignkey')
        batch_op.drop_constraint('fk_fraud_labels_verified_by_user_id', type_='foreignkey')
        batch_op.drop_constraint('fk_fraud_labels_auditor_user_id', type_='foreignkey')
        batch_op.drop_column('rejected_at')
        batch_op.drop_column('rejected_by_user_id')
        batch_op.drop_column('rejected_by')
        batch_op.drop_column('rejection_reason')
        batch_op.drop_column('confidence_score')
        batch_op.drop_column('evidence_checksum_sha256')
        batch_op.drop_column('evidence_document_path')
        batch_op.drop_column('verified_at')
        batch_op.drop_column('verified_by_user_id')
        batch_op.drop_column('verified_by')
        batch_op.drop_column('submitted_at')
        batch_op.drop_column('auditor_user_id')

    op.drop_index(op.f('ix_label_history_label_id'), table_name='label_history')
    op.drop_table('label_history')
