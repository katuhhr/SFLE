from django.apps import AppConfig


class AdminApiConfig(AppConfig):
    """API админки; label отличен от django.contrib.admin, иначе конфликт имён."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'admin'
    label = 'admin_api'
