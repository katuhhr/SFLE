# Таблица material (учебные материалы по теме). Ранее модель была в коде без миграции — без таблицы падает /api/student/learning-materials/.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_remove_major_course_theme'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS material (
                id SERIAL PRIMARY KEY,
                theme_id INTEGER NOT NULL REFERENCES theme(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                type VARCHAR(50) NOT NULL,
                url TEXT,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            """,
            reverse_sql='DROP TABLE IF EXISTS material;',
        ),
    ]
