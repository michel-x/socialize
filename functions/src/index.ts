import * as functions from 'firebase-functions';
import 'firebase/auth';
import 'firebase/firestore';
import express from 'express';
import {getAllScreams, postOneScream} from './handlers/screams';
import {signup, login, uploadImage} from './handlers/users';
import FBAuth from './util/FBAuth';

const app = express();

// Screams routes
app.get('/screams', getAllScreams);
app.post('/screams', FBAuth, postOneScream);

// auth routes
app.post('/signup', signup);
app.post('/login', login);

// users routes
app.post('/user/image', FBAuth, uploadImage);

export const api = functions.https.onRequest(app);