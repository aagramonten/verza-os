import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type ChatState =
  | 'STARTED'
  | 'COLLECTING_CONTACT'
  | 'COLLECTING_PROJECT'
  | 'COLLECTING_MEDIA'
  | 'COLLECTING_MEASUREMENTS'
  | 'READY_FOR_CONFIRMATION'
  | 'CONFIRMED'
  | 'ABANDONED';

export interface PublicMessage {
  id: string;
  role: 'CUSTOMER' | 'VERA';
  content: string;
  createdAt: string;
}

export interface SessionCreated {
  sessionId: string;
  leadReference: string;
  state: ChatState;
  resumeToken: string;
  createdAt: string;
}

export interface PublicSession {
  sessionId: string;
  leadReference: string;
  state: ChatState;
  messages: PublicMessage[];
  summary: ConfirmationSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryLine {
  label: string;
  value: string;
}

export interface ConfirmationSummary {
  lines: SummaryLine[];
  photoCount: number;
}

export interface MessagesCreated {
  messages: PublicMessage[];
  state: ChatState;
  summary: ConfirmationSummary | null;
}

export type QuickActionEvent =
  | 'USER_DOES_NOT_KNOW_MEASUREMENTS'
  | 'USER_REQUESTS_SITE_VISIT'
  | 'USER_UPLOADS_PHOTOS'
  | 'USER_HAS_BUDGET'
  | 'USER_WANTS_LOW_MAINTENANCE'
  | 'USER_WANTS_LUXURY';

const BASE = '/api/v1/public/chat';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);

  createSession(): Promise<SessionCreated> {
    return firstValueFrom(this.http.post<SessionCreated>(`${BASE}/sessions`, {}));
  }

  sendMessage(sessionId: string, resumeToken: string, message: string): Promise<MessagesCreated> {
    return firstValueFrom(
      this.http.post<MessagesCreated>(
        `${BASE}/sessions/${sessionId}/messages`,
        { message },
        { headers: new HttpHeaders({ 'x-resume-token': resumeToken }) },
      ),
    );
  }

  sendAction(
    sessionId: string,
    resumeToken: string,
    event: QuickActionEvent,
  ): Promise<MessagesCreated> {
    return firstValueFrom(
      this.http.post<MessagesCreated>(
        `${BASE}/sessions/${sessionId}/actions`,
        { event },
        { headers: new HttpHeaders({ 'x-resume-token': resumeToken }) },
      ),
    );
  }

  resume(sessionId: string, resumeToken: string): Promise<PublicSession> {
    return firstValueFrom(
      this.http.post<PublicSession>(`${BASE}/sessions/${sessionId}/resume`, { resumeToken }),
    );
  }

  confirm(sessionId: string, resumeToken: string): Promise<MessagesCreated> {
    return firstValueFrom(
      this.http.post<MessagesCreated>(
        `${BASE}/sessions/${sessionId}/confirm`,
        {},
        { headers: new HttpHeaders({ 'x-resume-token': resumeToken }) },
      ),
    );
  }

  correct(sessionId: string, resumeToken: string): Promise<MessagesCreated> {
    return firstValueFrom(
      this.http.post<MessagesCreated>(
        `${BASE}/sessions/${sessionId}/correct`,
        {},
        { headers: new HttpHeaders({ 'x-resume-token': resumeToken }) },
      ),
    );
  }

  getSession(sessionId: string, resumeToken: string): Promise<PublicSession> {
    return firstValueFrom(
      this.http.get<PublicSession>(`${BASE}/sessions/${sessionId}`, {
        headers: new HttpHeaders({ 'x-resume-token': resumeToken }),
      }),
    );
  }

  uploadMedia(
    sessionId: string,
    resumeToken: string,
    file: File,
  ): Promise<{ mediaId: string; photoCount: number }> {
    const form = new FormData();
    form.append('photo', file);
    // Content-Type (multipart boundary) is set automatically for FormData bodies.
    return firstValueFrom(
      this.http.post<{ mediaId: string; photoCount: number }>(
        `${BASE}/sessions/${sessionId}/media`,
        form,
        { headers: new HttpHeaders({ 'x-resume-token': resumeToken }) },
      ),
    );
  }
}
