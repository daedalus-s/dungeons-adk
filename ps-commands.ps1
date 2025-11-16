$body = @{
    username = "testuser"
    password = "test123"
    role = "user"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -Body $body -ContentType "application/json"