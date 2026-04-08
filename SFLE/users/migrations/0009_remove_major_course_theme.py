# Удаление таблицы major_course_theme: привязка темы к специальности и курсу только в theme.major_id / theme.course_id.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_major_course_theme'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='MajorCourseTheme'),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql='DROP TABLE IF EXISTS major_course_theme;',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
