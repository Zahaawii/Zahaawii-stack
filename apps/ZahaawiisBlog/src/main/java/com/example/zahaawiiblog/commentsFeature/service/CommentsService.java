package com.example.zahaawiiblog.commentsFeature.service;

import com.example.zahaawiiblog.commentsFeature.DTO.CommentsDTO;
import com.example.zahaawiiblog.commentsFeature.entity.Comments;
import com.example.zahaawiiblog.commentsFeature.mapper.CommentsMapper;
import com.example.zahaawiiblog.commentsFeature.repository.CommentsRepository;
import com.example.zahaawiiblog.entity.Blog;
import com.example.zahaawiiblog.repositories.BlogRepository;
import com.example.zahaawiiblog.repositories.UserRepository;
import com.example.zahaawiiblog.securityFeature.Entity.UserInfo;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class CommentsService {

    private final CommentsRepository commentsRepository;
    private final BlogRepository blogRepository;
    private final UserRepository userRepository;

    public CommentsService(CommentsRepository commentsRepository, BlogRepository blogRepository, UserRepository userRepository) {
        this.commentsRepository = commentsRepository;
        this.blogRepository = blogRepository;
        this.userRepository = userRepository;
    }

    public CommentsDTO add(CommentsDTO comment) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Optional<UserInfo> test = userRepository.findByName(auth.getName());
        Blog blog = blogRepository.findBlogByBlogId(comment.blogId());
        Comments c = new Comments();
        c.setUserComment(comment.comment());
        c.setCreatedComment(Date.valueOf(LocalDate.now()));
        c.setBlog(blog);
        c.setUser(test.get());
        Comments saved = commentsRepository.save(c);
        return CommentsMapper.toDTO(saved);
    }

    public Long deleteByCommentId(Long id) {
        commentsRepository.deleteById(id);
        return id;
    }

    public List<CommentsDTO> findCommentsByBlogId(Long id) {
        List<Comments> getAll = commentsRepository.findByBlog_BlogId(id);
        List<CommentsDTO> result = new ArrayList<>();

        for(Comments c : getAll) {
            result.add(CommentsMapper.toDTO(c));
        }
        return result;

        /*
          Chat siger man kan gøre det på denne måde har dog ikke lært det
          return getAll.stream()
                           .map(CommentMapper::toDTO)   // kalder din static mapper-metode
                           .toList();
         */
    }
}
