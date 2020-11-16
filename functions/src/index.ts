import * as functions from 'firebase-functions';
import 'firebase/auth';
import 'firebase/firestore';
import express from 'express';
import cors from 'cors';
import {getAllScreams, postOneScream, getScream, commentOnScream, likeScream, unLikeScream, deleteScream} from './handlers/screams';
import {signup, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead} from './handlers/users';
import FBAuth from './util/FBAuth';
import { Collection, Like, Notification, Scream, Comment} from './types';
import {db} from './util/admin';
import { DateTime } from 'luxon';


const app = express();
app.use(cors());

// Screams routes
app.get('/screams', getAllScreams);
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
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);


export const api = functions.https.onRequest(app);

export const createNotificationOnLike = functions.firestore.document(`${Collection.likes}/{id}`)
    .onCreate(async (snapshot) => {
        try {
            const likeData: Like = {...snapshot.data(), id: snapshot.id} as Like;
            const screamSnapshot = await db.collection(Collection.screams)
                .doc(likeData.screamId)
                .get();
            
            if (screamSnapshot.exists) {
                const screamData: Scream = {...screamSnapshot.data(), id: screamSnapshot.id} as Scream;

                if (screamData.userHandle !== likeData.userHandle) {
                    await db.collection(Collection.notifications)
                        .doc(likeData.id)
                        .set({
                            createdAt: DateTime.utc().toISO(),
                            recipient: screamData.userHandle,
                            sender: likeData.userHandle,
                            type: 'like',
                            read: false,
                            screamId: screamData.id
                        } as Omit<Notification, "id">);
                }
            }
        } catch (e) {
            console.error(e);
            return;
        }
    });

export const createNotificationOnComment = functions.firestore.document(`${Collection.comments}/{id}`)
    .onCreate(async (snapshot) => {
        try {
            const commentData: Comment = {...snapshot.data(), id: snapshot.id} as Comment;
            const screamSnapshot = await db.collection(Collection.screams)
                .doc(commentData.screamId)
                .get();
            const screamData: Scream = {...screamSnapshot.data(), id: screamSnapshot.id} as Scream;
            
            if (screamSnapshot.exists) {
                await db.collection(Collection.notifications)
                    .doc(commentData.id)
                    .set({
                        createdAt: DateTime.utc().toISO(),
                        recipient: screamData.userHandle,
                        sender: commentData.userHandle,
                        type: 'comment',
                        read: false,
                        screamId: screamData.id
                    } as Omit<Notification, "id">);
            }
        } catch (e) {
            console.error(e);
            return;
        }
    });

export const deleteNotificationOnUnLike = functions.firestore.document(`${Collection.likes}/{id}`)
    .onDelete(async (likeSnapshot) => {
        try {
            const likeData: Like = {...likeSnapshot.data(), id: likeSnapshot.id} as Like;
            await db.collection(Collection.notifications)
                .doc(likeData.id)
                .delete();
        
        } catch (e) {
            console.error(e);
            return;
        }
    });

export const onUserImageChange = functions.firestore.document(`${Collection.users}/{userId}`)
    .onUpdate(async (change) => {
        if (change.before.data().imageUrl !== change.after.data().imageUrl) {
            const batch = db.batch();
            const screamSnapshots = await db.collection(Collection.screams)
                .where('userHandle', '==', change.before.data().handle)
                .get();
            screamSnapshots.forEach((screamSnapshot) => {
                const scream = db.collection(Collection.screams).doc(screamSnapshot.id);
                batch.update(scream, {userImage: change.after.data().imageUrl} as Partial<Scream>);
            });
            await batch.commit();
        }
    });

export const onScreamDeleted = functions.firestore.document(`${Collection.screams}/{screamId}`)
    .onDelete(async (snapshot, context) => {
        try {
            const screamId = context.params.screamId;
            const batch = db.batch();
            const commentSnapshots = await db.collection(Collection.comments)
                .where('screamId', '==', screamId)
                .get();
            commentSnapshots.forEach((commentSnapshot) => {
                batch.delete(db.collection(Collection.comments).doc(commentSnapshot.id));
            });

            const likeSnapshots = await db.collection(Collection.likes)
                .where('screamId', '==', screamId)
                .get();
            likeSnapshots.forEach((likeSnapshot) => {
                batch.delete(db.collection(Collection.likes).doc(likeSnapshot.id));
            });

            const notificationSnapshots = await db.collection(Collection.notifications)
                .where('screamId', '==', screamId)
                .get();
            notificationSnapshots.forEach((notificationSnapshot) => {
                batch.delete(db.collection(Collection.notifications).doc(notificationSnapshot.id));
            });
            await batch.commit();
        } catch (e) {
            console.error(e);
            return;
        } 
    });