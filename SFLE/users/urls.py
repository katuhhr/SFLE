from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('register/', views.register, name='auth_register'),
    # JWT login (в теле можно передать email в поле username)
    path('token/', views.EmailAwareTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Current user
    path('me/', views.me, name='auth_me'),
]
