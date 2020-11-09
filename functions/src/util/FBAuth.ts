import * as functions from 'firebase-functions';
import 'firebase/auth';
import 'firebase/firestore';
import {admin, db} from '../util/admin';
import {RequestHandler} from 'express';
import {Collection, Request, User} from '../types';


const FBAuth: RequestHandler = async (req: Request, res, next) => {

    try {
        let idToken: string | undefined;

        if (req.headers.authorization?.startsWith('Bearer ')) {
            idToken = req.headers.authorization.split('Bearer ')[1];
        } else {
            return res.status(403).json({error: {code: 403, message: 'Unauthorized'}});
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;

        const snapsUsers = await db.collection(Collection.users)
                .where('userId', '==', decodedToken.uid)
                .limit(1)
                .get();

        const userData = snapsUsers.docs[0].data() as Omit<User, "id">;
        req.user.handle = userData.handle;
        next();

        return;
    } catch (e) {
        functions.logger.log(e);
        return res.status(500).json({error: {code: 500, message: e.message}});
    } 
};

export default FBAuth;