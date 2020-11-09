import * as functions from 'firebase-functions';
import {RequestHandler} from 'express';
import {DateTime} from 'luxon';
import {Collection, Scream, Request} from '../types';
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
        res.status(500).json({error: {code: 500, message: e.message}});
    } 
};


export const postOneScream: RequestHandler = async (req: Request, res) => {

    try {
        const newScream: Omit<Scream, "id"> = {
            body: req.body.body,
            userHandle: req.user?.handle ?? '',
            createdAt: DateTime.utc().toISO(),
            likeCount: 1,
            commentCount: 3
        };
        const snaps = await db.collection(Collection.screams)
                    .add(newScream);

        res.status(200).json({id: snaps.id});

    } catch (e) {
        res.status(500).json({error: {code: 500, message: e.message}});
    }
};