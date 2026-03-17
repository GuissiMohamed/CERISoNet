// ======================================================
// Étape 4 - Gestion du temps réel dans le mur
// Ce composant gère :
// - les mises à jour en temps réel (likes, partages)
// - l'affichage des utilisateurs connectés
// - les interactions utilisateur sans rechargement
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
      error: () => this.router.navigate(['/'])
    });
  }

  ngOnDestroy(): void {
    this.socketSubs.forEach((s) => s.unsubscribe());
  }

  listenSocketEvents() {
    this.socketSubs.push(
      this.websocket.listen('post-liked').subscribe((data: any) => {
        const post = this.posts.find((p) => p._id === data.postId);
        if (post) {
          post.likes = data.likes;
        }
      })
    );

    

    this.socketSubs.push(
      this.websocket.listen('post-shared').subscribe((data: any) => {
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
        this.notify.show(data.type || 'info', data.message || 'Notification');
      })
    );

    this.socketSubs.push(
      this.websocket.listen('ws-error').subscribe((data: any) => {
        this.notify.show('error', data?.message || 'Erreur WebSocket');
      })
    );
  }

  logout() {
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

  loadPosts(reset: boolean = false) {
    if (reset) {
      this.skip = 0;
      this.posts = [];
    }

    this.auth.getPosts({
      sort: this.sort,
      owner: this.owner,
      hashtag: this.hashtag.trim(),
      limit: this.limit,
      skip: this.skip
    }).subscribe({
      next: (res: any) => {
        const newPosts = res.posts || [];

        if (reset) {
          this.posts = newPosts;
        } else {
          this.posts = [...this.posts, ...newPosts];
        }
      },
      error: () => {
        this.notify.show('error', 'Erreur chargement posts');
      }
    });
  }

  loadMore() {
    this.skip += this.limit;
    this.loadPosts(false);
  }

  applyFilters() {
    this.loadPosts(true);
  }

  clearFilters() {
    this.sort = 'newest';
    this.owner = 'all';
    this.hashtag = '';
    this.loadPosts(true);
  }

  addPost() {
    if (!this.newPost.trim()) return;

    this.auth.createPost(this.newPost).subscribe({
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

  likePost(postId: string) {
    this.websocket.emit('like-post', { postId });
  }

  sharePost(postId: string) {
    const body = this.shareInputs[postId] || '';

    this.websocket.emit('share-post', {
      postId,
      body
    });

    this.shareInputs[postId] = '';
  }

  addComment(postId: string) {
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

  trackByPost(index: number, post: any) {
    return post._id;
  }

  normalizedHashtag(tag: string) {
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
  }

  filterByHashtag(tag: string) {
    this.hashtag = this.normalizedHashtag(tag);
    this.loadPosts(true);
  }

  isMyPost(post: any): boolean {
    return this.user && post.createdBy === this.user.id;
  }

  hasLiked(post: any): boolean {
  return post.likedBy?.includes(this.user.id);
}
}