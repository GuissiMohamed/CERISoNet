// ======================================================
// Étape 4 - Gestion du temps réel dans le mur
// ======================================================

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth';
import { NotifyService } from '../../services/notify';
import { WebsocketService } from '../../services/websocket';

@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wall.html',
  styleUrl: './wall.css'
})
export class WallComponent implements OnInit, OnDestroy {
  user: any = null;
  posts: any[] = [];
  onlineUsers: any[] = [];

  newPost = '';

  sort = 'newest';
  owner = 'all';
  hashtag = '';

  limit = 10;
  skip = 0;

  isLoading = false;
  hasMore = true;

  commentInputs: { [postId: string]: string } = {};
  shareInputs: { [postId: string]: string } = {};

  private socketSubs: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private notify: NotifyService,
    private router: Router,
    private websocket: WebsocketService
  ) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: (r: any) => {
        this.user = r.user;

        this.websocket.connect();
        this.listenSocketEvents();

        this.loadPosts(true);
      },
      error: () => {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy(): void {
    this.socketSubs.forEach((s) => s.unsubscribe());
    this.websocket.disconnect();
  }

  listenSocketEvents(): void {
    this.socketSubs.push(
      this.websocket.listen('post-liked').subscribe((data: any) => {
        const post = this.posts.find((p) => p._id === data.postId);

        if (post) {
          post.likes = data.likes;

          if (Array.isArray(data.likedBy)) {
            post.likedBy = data.likedBy;
          } else if (data.likedBy?.id) {
            const oldLikedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
            post.likedBy = [...new Set([...oldLikedBy, data.likedBy.id])];
          }
        }
      })
    );

    this.socketSubs.push(
      this.websocket.listen('post-shared').subscribe(() => {
        this.notify.show('success', 'Partage reçu en temps réel');
        this.loadPosts(true);
      })
    );

    this.socketSubs.push(
      this.websocket.listen('online-users').subscribe((data: any) => {
        this.onlineUsers = data || [];
      })
    );

    this.socketSubs.push(
      this.websocket.listen('notification').subscribe((data: any) => {
        if (!data) return;

        this.notify.show(
          data.type || 'success',
          data.message || 'Notification'
        );
      })
    );

    this.socketSubs.push(
      this.websocket.listen('ws-error').subscribe((data: any) => {
        this.notify.show('error', data?.message || 'Erreur WebSocket');
      })
    );
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        this.websocket.disconnect();
        this.notify.show('success', 'Déconnexion réussie 👋');
        this.router.navigate(['/']);
      },
      error: () => {
        this.notify.show('error', 'Erreur déconnexion');
      }
    });
  }

  loadPosts(reset: boolean = false): void {
    if (this.isLoading) return;

    if (reset) {
      this.skip = 0;
      this.posts = [];
      this.hasMore = true;
    }

    this.isLoading = true;

    this.auth.getPosts({
      sort: this.sort,
      owner: this.owner,
      hashtag: this.hashtag.trim(),
      limit: this.limit,
      skip: this.skip
    }).subscribe({
      next: (res: any) => {
        const newPosts = Array.isArray(res?.posts) ? res.posts : [];

        if (reset) {
          this.posts = newPosts;
        } else {
          this.posts = [...this.posts, ...newPosts];
        }

        this.hasMore = newPosts.length === this.limit;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Erreur /api/posts :', err);

        this.isLoading = false;
        this.hasMore = false;
        this.notify.show('error', 'Erreur chargement posts');
      }
    });
  }

  loadMore(): void {
    if (this.isLoading || !this.hasMore) return;

    this.skip += this.limit;
    this.loadPosts(false);
  }

  applyFilters(): void {
    this.loadPosts(true);
  }

  clearHashtag(): void {
    this.hashtag = '';
    this.loadPosts(true);
  }

  addPost(): void {
    const body = this.newPost.trim();

    if (!body) return;

    this.auth.createPost(body).subscribe({
      next: () => {
        this.newPost = '';
        this.loadPosts(true);
        this.notify.show('success', 'Post publié ✅');
      },
      error: () => {
        this.notify.show('error', 'Erreur publication');
      }
    });
  }

  likePost(postId: string): void {
    this.websocket.emit('like-post', { postId });
  }

  sharePost(postId: string): void {
    const body = this.shareInputs[postId] || '';

    this.websocket.emit('share-post', {
      postId,
      body
    });

    this.shareInputs[postId] = '';
  }

  addComment(postId: string): void {
    const text = (this.commentInputs[postId] || '').trim();

    if (!text) return;

    this.auth.addComment(postId, text).subscribe({
      next: () => {
        this.commentInputs[postId] = '';
        this.loadPosts(true);
        this.notify.show('success', 'Commentaire posté');
      },
      error: () => {
        this.notify.show('error', 'Erreur commentaire');
      }
    });
  }

  trackByPost(index: number, post: any): string {
    return post._id;
  }

  normalizedHashtag(tag: string): string {
    if (!tag) return '';

    const clean = tag.trim();

    return clean.startsWith('#') ? clean : `#${clean}`;
  }

  filterByHashtag(tag: string): void {
    this.hashtag = this.normalizedHashtag(tag);
    this.loadPosts(true);
  }

  isMyPost(post: any): boolean {
    return this.user && post.createdBy === this.user.id;
  }

  hasLiked(post: any): boolean {
    if (!this.user) return false;

    if (Array.isArray(post.likedBy)) {
      return post.likedBy.includes(this.user.id);
    }

    if (Array.isArray(post.likes)) {
      return post.likes.includes(this.user.id);
    }

    return false;
  }

  getLikesCount(post: any): number {
    if (!post) return 0;

    if (typeof post.likes === 'number') {
      return post.likes;
    }

    if (Array.isArray(post.likes)) {
      return post.likes.length;
    }

    if (Array.isArray(post.likedBy)) {
      return post.likedBy.length;
    }

    if (typeof post.likes === 'string') {
      if (post.likes.startsWith('legacy_')) {
        const value = Number(post.likes.replace('legacy_', ''));
        return Number.isFinite(value) ? value : 0;
      }

      const value = Number(post.likes);
      return Number.isFinite(value) ? value : 0;
    }

    return 0;
  }
}