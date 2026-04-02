#!/usr/bin/env python
"""
Запуск Django из корня репозитория (рабочий проект — каталог SFLE/).
Использование: python manage.py runserver
"""
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent / "SFLE"
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "SFLE.settings")

from django.core.management import execute_from_command_line

if __name__ == "__main__":
    execute_from_command_line(sys.argv)
