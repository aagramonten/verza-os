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
  createdAt: string;
  updatedAt: string;
}

export interface MessagesCreated {
  messages: PublicMessage[];
  state: ChatState;
}

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

  resume(sessionId: string, resumeToken: string): Promise<PublicSession> {
    return firstValueFrom(
      this.http.post<PublicSession>(`${BASE}/sessions/${sessionId}/resume`, { resumeToken }),
    );
  }
}
