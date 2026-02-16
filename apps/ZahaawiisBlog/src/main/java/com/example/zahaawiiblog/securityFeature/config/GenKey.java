package com.example.zahaawiiblog.securityFeature.config;

import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.util.Base64;

public class GenKey {
    public static void main(String[] args) {
        var key = Keys.secretKeyFor(SignatureAlgorithm.HS256); // 256-bit
        System.out.println(Base64.getEncoder().encodeToString(key.getEncoded()));
    }
}

