"""Аутентификация по email или username (сессии, при необходимости)."""

from django.contrib.auth.backends import ModelBackend


class EmailOrUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None

        from django.contrib.auth import get_user_model

        User = get_user_model()
        login = str(username).strip()
        if not login:
            return None

        if '@' in login:
            user = User.objects.filter(email__iexact=login).first()
        else:
            user = User.objects.filter(username=login).first()

        if user is None:
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
