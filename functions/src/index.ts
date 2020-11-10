import * as functions from 'firebase-functions';
import 'firebase/auth';
import 'firebase/firestore';
import express from 'express';
import {getAllScreams, postOneScream, getScream, commentOnScream, likeScream, unLikeScream, deleteScream} from './handlers/screams';
import {signup, login, uploadImage, addUserDetails, getAuthenticatedUser} from './handlers/users';
import FBAuth from './util/FBAuth';

const app = express();

// Screams routes
app.get('/screams', FBAuth, getAllScreams);
app.post('/screams', FBAuth, postOneScream);
app.get('/screams/:screamId', FBAuth, getScream);
app.post('/screams/:screamId/comments', FBAuth, commentOnScream);
app.delete('/screams/:screamId', FBAuth, deleteScream);
app.post('/screams/:screamId/like', FBAuth, likeScream);
app.post('/screams/:screamId/unlike', FBAuth, unLikeScream);

// auth routes
app.post('/signup', signup);
app.post('/login', login);

// users routes
app.post('/user/image', FBAuth, uploadImage);
app.post('/user/', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);

export const api = functions.https.onRequest(app);