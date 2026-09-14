from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

class CustomUser(AbstractUser):
    # Add any additional fields here if needed
    pass

    def __str__(self):
        return self.username

class Document(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='documents')
    source = models.CharField(max_length=255) # filename or URL
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.source} ({self.user.username})"
