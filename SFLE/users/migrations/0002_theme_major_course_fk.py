# Добавление привязки тем к специальности и курсу (см. Theme.major / Theme.course).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE theme ADD COLUMN IF NOT EXISTS major_id INTEGER NULL '
                'REFERENCES major(id) ON DELETE SET NULL;'
            ),
            reverse_sql='ALTER TABLE theme DROP COLUMN IF EXISTS major_id;',
        ),
        migrations.RunSQL(
            sql=(
                'ALTER TABLE theme ADD COLUMN IF NOT EXISTS course_id INTEGER NULL '
                'REFERENCES course(id) ON DELETE SET NULL;'
            ),
            reverse_sql='ALTER TABLE theme DROP COLUMN IF EXISTS course_id;',
        ),
    ]
