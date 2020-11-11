import {Request as RequestExpress} from 'express';
import admin from 'firebase-admin';

export enum Collection {
    screams = 'screams',
    users = 'users',
    likes = 'likes',
    comments = 'comments',
    notifications = 'notifications'
};

export interface Scream {
    id: string;
    userHandle: string;
    createdAt: any
    body: string;
    likeCount: number;
    commentCount: number;
    userImage?: string;
}

export interface UserDetail {
    website: string;
    bio: string;
    location: string;
}

export interface Comment {
    id: string;
    userHandle: string;
    screamId: string;
    body: string;
    createdAt: string;
}

export interface Like {
    id: string;
    screamId: string;
    userHandle: string;
}

export interface Notification {
    id: string;
    recipient: string;
    sender: string;
    read: boolean;
    screamId: string;
    type: 'like' | 'comment';
    createdAt: string;
}

export interface User extends Partial<UserDetail> {
    id: string;
    email: string;
    createdAt: string;
    handle: string;
    userId: string;
    imageUrl: string;
}

export interface Request extends RequestExpress {
    user?: admin.auth.DecodedIdToken & {
        handle?: string;
        imageUrl?: string;
    };
}

export {Response, NextFunction} from 'express';