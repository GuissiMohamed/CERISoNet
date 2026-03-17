import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}

  login(mail: string, password: string) {
    return this.http.post(
      '/api/login',
      { mail, password },
      { withCredentials: true }
    );
  }

  me() {
    return this.http.get('/api/me', { withCredentials: true });
  }

  logout() {
    return this.http.post('/api/logout', {}, { withCredentials: true });
  }

  getPosts(filters: {
    sort?: string;
    owner?: string;
    hashtag?: string;
    limit?: number;
    skip?: number;
  } = {}) {
    let params = new HttpParams();

    if (filters.sort) params = params.set('sort', filters.sort);
    if (filters.owner) params = params.set('owner', filters.owner);
    if (filters.hashtag) params = params.set('hashtag', filters.hashtag);
    if (filters.limit !== undefined) params = params.set('limit', filters.limit);
    if (filters.skip !== undefined) params = params.set('skip', filters.skip);

    return this.http.get<any>('/api/posts', {
      params,
      withCredentials: true
    });
  }

  createPost(body: string) {
    return this.http.post(
      '/api/posts',
      { body },
      { withCredentials: true }
    );
  }

  addComment(postId: string, text: string) {
    return this.http.post(
      `/api/posts/${postId}/comments`,
      { text },
      { withCredentials: true }
    );
  }
}