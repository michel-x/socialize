import * as functions from 'firebase-functions';
import {RequestHandler} from 'express';
import {DateTime} from 'luxon';
import {Collection, Scream, Request, Comment, Like} from '../types';
import {db} from '../util/admin';


export const getAllScreams: RequestHandler = async (req: Request, res) => {
    try {

        const snaps = await db.collection(Collection.screams)
                    .orderBy('createdAt', 'desc')
                    .get();

        functions.logger.log({snaps});
        const screams: Scream[] = snaps.docs.map(snap => ({...snap.data(), id: snap.id} as Scream));

        res.status(200).json({screams});

    } catch (e) {
        functions.logger.error(e);
        res.status(500).json({error: {code: 500, message: e.message}});
    } 
};


export const postOneScream: RequestHandler = async (req: Request, res) => {

    try {
        const newScream: Omit<Scream, "id"> = {
            body: req.body.body,
            userHandle: req.user?.handle ?? '',
            createdAt: DateTime.utc().toISO(),
            userImage: req.user?.imageUrl || '',
            likeCount: 0,
            commentCount: 0
        };
        const screamDoc = await db.collection(Collection.screams)
                    .add(newScream);
        const screamData: Scream = {...newScream, id: screamDoc.id};
        res.status(200).json(screamData);

    } catch (e) {
        res.status(500).json({error: {code: 500, message: e.message}});
    }
};

// Fetch on scream
export const getScream: RequestHandler = async (req: Request, res) => {

    try {
        const screamDoc = await db.collection(Collection.screams)
            .doc(req.params.screamId)
            .get();
        if (!screamDoc.exists) {
            return res.status(404).json({error: {code: 404, message: 'Scream not found'}});
        }
        const screamData: Scream = {id: screamDoc.id, ...screamDoc.data()} as Scream;
        
        const commentDocs = await db.collection(Collection.comments)
            .where('screamId', '==', req.params.screamId)
            // .orderBy('createdAt', 'desc')
            .get();
        const commentsData: Comment[] = commentDocs.docs.map((doc) => ({...doc.data(), id: doc.id} as Comment));

        return res.status(200).json({scream: screamData, comments: commentsData});
    } catch (e) {
        console.error(e);
        return res.status(500).json({error: {code: e.code, message: e.message}});
    }
};

export const commentOnScream: RequestHandler = async (req: Request, res) => {

    if (req.body.body.trim() === '') {
        return res.status(400).json({error: {code: 400, message: 'Must not be empty'}});
    }

    const newComment = {
        body: req.body.body,
        createdAt: DateTime.utc().toISO(),
        screamId: req.params.screamId,
        userHandle: req.user?.handle!,
        userImage: req.user?.imageUrl
    };

    try {
        const screamDoc = await db.collection(Collection.screams)
                        .doc(req.params.screamId)
                        .get();
        if (!screamDoc.exists) {
            return res.status(404).json({error: {code: 404, message: 'Scream not found'}});
        }
        const screamData: Scream = {...screamDoc.data(), id: screamDoc.id} as Scream;

        await db.collection(Collection.comments)
                .add(newComment);
        await db.collection(Collection.screams)
                .doc(req.params.screamId)
                .update({commentCount: screamData.commentCount + 1} as Scream);
        return res.status(201).json(newComment);
    } catch (e) {
        console.error(e);
        return res.status(500).json({error: {code: e.code, message: e.message}});
    }
};

export const likeScream: RequestHandler = async (req: Request, res) => {
    try {
        const [screamDoc, likeDocs] = await Promise.all([
            db.collection(Collection.screams)
                .doc(req.params.screamId)
                .get(),
            db.collection(Collection.likes)
                .where('userHandle', '==', req.user?.handle!)
                .where('screamId', '==', req.params.screamId)
                .limit(1)
                .get()
        ]);

        if (screamDoc.exists) {
            const screamData: Scream = {...screamDoc.data(), id: screamDoc.id} as Scream;
            if (likeDocs.empty) {
                await db.collection(Collection.likes)
                    .add({
                        screamId: req.params.screamId,
                        userHandle: req.user?.handle!
                    } as Omit<Like, "id">);
                await db.collection(Collection.screams)
                    .doc(req.params.screamId)
                    .update({likeCount: screamData.likeCount + 1} as Partial<Scream>);

                return res.status(200).json({...screamData, likeCount: screamData.likeCount + 1} as Scream);
            } else {
                return res.status(400).json({error: {code: 400, message: 'Scream already liked'}});
            }
        } else {
            return res.status(404).json({error: {code: 404, message: 'Scream not found'}});
        }

    } catch (e) {
        console.error(e);
        return res.status(500).json({error: {code: e.code || 500, message: e.message}});
    }
};

export const unLikeScream: RequestHandler = async (req: Request, res) => {
    try {
        const [screamDoc, likeDocs] = await Promise.all([
            db.collection(Collection.screams)
                .doc(req.params.screamId)
                .get(),
            db.collection(Collection.likes)
                .where('userHandle', '==', req.user?.handle!)
                .where('screamId', '==', req.params.screamId)
                .limit(1)
                .get()
        ]);

        if (screamDoc.exists) {
            const screamData: Scream = {...screamDoc.data(), id: screamDoc.id} as Scream;
            if (!likeDocs.empty) {
                await db.collection(Collection.likes)
                    .doc(likeDocs.docs[0].id)
                    .delete();
                await db.collection(Collection.screams)
                    .doc(req.params.screamId)
                    .update({likeCount: screamData.likeCount - 1} as Partial<Scream>);

                return res.status(200).json({...screamData, likeCount: screamData.likeCount - 1} as Scream);
            } else {
                return res.status(400).json({error: {code: 400, message: 'Scream not liked'}});
            }
        } else {
            return res.status(404).json({error: {code: 404, message: 'Scream not found'}});
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json({error: {code: e.code || 500, message: e.message}});
    }
};

// Delete a scream
export const deleteScream: RequestHandler = async (req: Request, res) => {
    try {
        const screamDoc = await db.collection(Collection.screams)
                            .doc(req.params.screamId)
                            .get();
        if (!screamDoc.exists) {
            return res.status(404).json({error: {code: 404, message: 'Scream not found'}});
        }

        const screamData: Scream = {...screamDoc.data(), id: screamDoc.id} as Scream;

        if (screamData.userHandle !== req.user?.handle) {
            return res.status(403).json({error: {code: 403, message: 'Unauthorized'}});
        }

        await db.collection(Collection.screams)
                .doc(req.params.screamId)
                .delete();

        return res.status(200).json({message: 'Scream deleted successfully'});

    } catch (e) {
        console.error(e);
        return res.status(500).json({error: {code: e.code || 500, message: e.message}});
    }
}; 


/* export const unLikeScream: RequestHandler = async (req: Request, res) => {
    try {

    } catch (e) {
        console.error(e);
        return res.status(500).json({error: {code: e.code || 500, message: e.message}});
    }
}; */