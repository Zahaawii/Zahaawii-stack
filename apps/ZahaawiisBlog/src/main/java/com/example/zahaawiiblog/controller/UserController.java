package com.example.zahaawiiblog.controller;


import com.example.zahaawiiblog.DTO.AuthResponseDTO;
import com.example.zahaawiiblog.DTO.SignupRequest;
import com.example.zahaawiiblog.logginFeature.service.LoggingService;
import com.example.zahaawiiblog.securityFeature.DTO.AuthResponse;
import com.example.zahaawiiblog.securityFeature.Entity.UserInfo;
import com.example.zahaawiiblog.securityFeature.Entity.AuthRequest;
import com.example.zahaawiiblog.securityFeature.service.JwtService;
import com.example.zahaawiiblog.securityFeature.service.UserInfoService;
import com.example.zahaawiiblog.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RequestMapping("/api/v1/users")
@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final UserInfoService service;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final LoggingService loggingService;

    @GetMapping("/getallusers")
    public ResponseEntity<List<UserInfo>> getAllUsers() {
        List<UserInfo> getAllUserInfos = userService.getAllUsers();
        return new ResponseEntity<>(getAllUserInfos, HttpStatus.OK);
    }

    @GetMapping("/getuserbyid/{userid}")
    public ResponseEntity<UserInfo> getUserById(@PathVariable int userid) {
        UserInfo findUserInfo = userService.getUserByUserId(userid);
        return new ResponseEntity<>(findUserInfo, HttpStatus.OK);
    }

    @GetMapping("/getuserbyname/{username}")
    public ResponseEntity<Optional<UserInfo>> getUserByName(@PathVariable String username) {
        Optional<UserInfo> findUser = userService.findUserByUsername(username);
        if(findUser.isPresent()) {
            return new ResponseEntity<>(findUser, HttpStatus.OK);
        }
        return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
    }

    @PostMapping("/createuser")
    public ResponseEntity<?> createUser(@RequestBody SignupRequest req) {
        if(userService.findUserByUsername(req.name()).isPresent()) {
            return new ResponseEntity<>("Username already exist", HttpStatus.BAD_REQUEST);
        }
        UserInfo u = new UserInfo(null, req.name(), req.email(),
                req.password(),Date.valueOf(LocalDate.now()) ,
                "USER", null, null);

        service.addUser(u);
        loggingService.log(u.getUserId(), u.getName() + ": was created", u.getName(), 1L);

        String token = jwtService.generateToken(req.name());

        return ResponseEntity.ok(new AuthResponseDTO(u.getUserId(), u.getName(), token));
    }


    @DeleteMapping("/deleteuser/{userId}")
    public ResponseEntity<?> deleteUserById(@PathVariable int userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Optional<UserInfo> user = userService.findUserByUsername(auth.getName());
        if(userService.deleteUserById(userId) == -1) {
            loggingService.log(user.get().getUserId(), auth.getName() +": Tried to delete user but failed", user.get().getName(), 4L);
            return new ResponseEntity<>("User does not exist", HttpStatus.NOT_FOUND);
        }
        userService.deleteUserById(userId);
        loggingService.log(user.get().getUserId(), auth.getName() + ": Deleted user succesfully", user.get().getName(), 3L);
        return new ResponseEntity<>("User with id " + userId + " has been deleted", HttpStatus.OK);
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest authRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(authRequest.getUsername(), authRequest.getPassword()));
        Optional<UserInfo> user = userService.findUserByUsername(authentication.getName());

        String token = jwtService.generateToken(authRequest.getUsername());
        long ttlSeconds = 15 * 60;
        loggingService.log(user.get().getUserId(), user.get().getName() + ": logged in to the system", authentication.getName(), 7L);
        return ResponseEntity.ok(new AuthResponse(token, authRequest.getUsername(),ttlSeconds));
    }

}
