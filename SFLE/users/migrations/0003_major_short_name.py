# Поле major.short_name — сокращение для интерфейса (ИСПк, Рк, …).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_theme_major_course_fk'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE major ADD COLUMN IF NOT EXISTS short_name VARCHAR(50) NULL;'
            ),
            reverse_sql='ALTER TABLE major DROP COLUMN IF EXISTS short_name;',
        ),
    ]
