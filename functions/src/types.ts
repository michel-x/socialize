import {Request as RequestExpress} from 'express';
import admin from 'firebase-admin';

export enum Collection {
    screams = 'screams',
    users = 'users'
};

export interface Scream {
    id: string;
    userHandle: string;
    createdAt: any
    body: string;
    likeCount: number;
    commentCount: number
}

export interface User {
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
    };
}

export {Response, NextFunction} from 'express';