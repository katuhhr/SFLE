"""Подписи специальности для UI.

Используются колонки таблицы major (если есть), по приоритету:
short_name → code → abbr → abbreviation → kod.
Иначе — поле name. ORM не требует этих колонок в модели Major.
"""

from django.db import connection

# Порядок важен: первая непустая колонка даёт краткую подпись (ИСПк, Рк, …).
_ABBR_COLUMN_PRIORITY = ('short_name', 'code', 'abbr', 'abbreviation', 'kod')

_abbr_columns_cache: list[str] | None = None


def _major_abbr_column_names() -> list[str]:
    """Имена колонок в текущей схеме (lower case), в порядке приоритета."""
    global _abbr_columns_cache
    if _abbr_columns_cache is not None:
        return _abbr_columns_cache
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT LOWER(column_name::text) FROM information_schema.columns
            WHERE table_schema = current_schema()
            AND table_name = 'major'
            """,
        )
        have = {r[0] for r in cur.fetchall() if r[0]}
    _abbr_columns_cache = [c for c in _ABBR_COLUMN_PRIORITY if c in have]
    return _abbr_columns_cache


def _label_coalesce_sql(cols: list[str]) -> str:
    parts = ', '.join(f"NULLIF(TRIM({c}::text), '')" for c in cols)
    return f'COALESCE({parts}, name::text)'


def majors_for_learning_catalog():
    """Строки для каталогов (учебные материалы, ведомость): id, name, label, short_name."""
    cols = _major_abbr_column_names()
    with connection.cursor() as cur:
        if cols:
            label_expr = _label_coalesce_sql(cols)
            cur.execute(
                f'SELECT id, name, {label_expr} AS label FROM major ORDER BY id'  # noqa: S608
            )
            rows = cur.fetchall()
            out = []
            for rid, name, label in rows:
                lbl = (label or name or '').strip() if label is not None else (name or '')
                nm = name or ''
                out.append({
                    'id': rid,
                    'name': nm,
                    'short_name': lbl if lbl != (nm.strip()) else None,
                    'label': lbl or nm,
                })
            return out
        cur.execute('SELECT id, name FROM major ORDER BY id')
        return [
            {
                'id': rid,
                'name': name or '',
                'short_name': None,
                'label': (name or '').strip(),
            }
            for rid, name in cur.fetchall()
        ]


def major_display_label(major_id: int | None) -> str | None:
    if major_id is None:
        return None
    cols = _major_abbr_column_names()
    with connection.cursor() as cur:
        if cols:
            label_expr = _label_coalesce_sql(cols)
            cur.execute(
                f'SELECT {label_expr} AS label FROM major WHERE id = %s',  # noqa: S608
                [major_id],
            )
            row = cur.fetchone()
            return (row[0] or '').strip() if row and row[0] is not None else None
        cur.execute('SELECT name FROM major WHERE id = %s', [major_id])
        row = cur.fetchone()
        return (row[0] or '').strip() if row else None


def major_theory_bundle_label(major_id: int, course_number: int) -> str:
    """Имя обёрточной theory для пары специальность + курс (как в интерфейсе)."""
    label = major_display_label(major_id) or ''
    return f'{label} — {course_number}'


# Совместимость со старым кодом (если где-то вызывалось)
def major_table_has_short_name() -> bool:
    return 'short_name' in _major_abbr_column_names()
