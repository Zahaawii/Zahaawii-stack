package com.example.zahaawiiblog.securityFeature.DTO;

public record AuthResponse(String accessToken, String username, long expiresIn) {
}
