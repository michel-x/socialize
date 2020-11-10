import firebase from 'firebase';
import * as functions from 'firebase-functions';
import * as Joi from '@hapi/joi';
import {default as BusBoy} from 'busboy';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {RequestHandler} from 'express';
import {DateTime} from 'luxon';
import {Collection, Request, User, UserDetail} from '../types';
import {db, admin} from '../util/admin';
import config from '../util/config';
import {reduceUserDetails} from '../util/validators';


firebase.initializeApp(config);

export const signup: RequestHandler = async (req, res) => {
    try {
        const newUser = {
            email: req.body.email?.trim(),
            password: req.body.password,
            confirmPassword: req.body.confirmPassword,
            handle: req.body.handle?.trim()
        }

        const schema = Joi.object({
            email: Joi.string().email({ tlds: { allow: false } }).required(),
            password: Joi.string().min(5).required(),
            confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
            handle: Joi.string().required()
        });

        const {error} = schema.validate(newUser);

        if (error) {
            const errors: {[key: string]: string} = {};
            error.details.forEach((detail) => errors[detail.path[0]] = detail.message);
            res.status(400).json({error: {code: 400, message: error.details[0].message}, errors});
            return;
        }

        const noImg: string = 'no-image.png';

        const snapUser = await db.collection(Collection.users)
                .doc(newUser.handle)
                .get();

        if (snapUser.exists) {
            res.status(400).json({error: {code: 400, message: 'Bad request'}, errors: {handle: 'This handle is already taken'}});
            return;

        } else {
            const userRecord = await firebase.auth()
                .createUserWithEmailAndPassword(newUser.email, newUser.password);
            const token = await userRecord.user?.getIdToken();

            const userCredentials: Omit<User, "id"> = {
                email: newUser.email,
                handle: newUser.handle,
                createdAt: DateTime.utc().toISO(),
                userId: userRecord.user?.uid || '',
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`
            };

            await db.collection(Collection.users)
                    .doc(newUser.handle)
                    .set(userCredentials);

            res.status(201).json({uid: userRecord.user?.uid, token});
        }    

    } catch (e) {
        functions.logger.error(e);
        if (e.code === 'auth/email-already-in-use') {
            res.status(500).json({error: {code: 400, message: 'Email is already in use'}, errors: {email: 'Email is already in use'}});

        } else {
            res.status(500).json({error: {code: 500, message: e.message}});
        }
    }
};

export const login: RequestHandler = async (req, res) => {

    try {
        const user = {
            email: req.body.email,
            password: req.body.password
        };
    
        const schema = Joi.object({
            email: Joi.string().email({tlds: {allow: false}}).required(),
            password: Joi.string().required(),
        });
    
        const {error} = schema.validate(user);
    
        if (error) {
            res.status(400).json({error: {code: 400, message: error.details[0].message}});
            return;
        }
    
        const userCredentials = await firebase.auth()
                .signInWithEmailAndPassword(user.email, user.password);
        
        const token = await userCredentials.user?.getIdToken();
    
        res.status(200).json({token});

    } catch (e) {
        functions.logger.error(e);
        if (e.code === 'auth/wrong-password') {
            res.status(403).json({error: {code: 403, message: 'Wrong credentials, please try again'}});
        }
        res.status(500).json({error: {code: 500, message: e.message}});
    }
}

export const uploadImage: RequestHandler = async (req: Request, res) => {
    const busBoy = new BusBoy({headers: req.headers});
    let imageFilename: string;
    let imageToBeUploaded: {filepath: string; mimetype: string} = {filepath: '', mimetype: ''};
    
    busBoy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.status(400).json({error: {code: 400, message: 'Wrong file type submitted'}});
        } else {
            console.log({filename, mimetype, fieldname});
            const imageExtensionSplit = filename.split('.');
            const imageExtension = imageExtensionSplit[imageExtensionSplit.length - 1];
            imageFilename = `${Math.round(Math.random() * 10000000000)}.${imageExtension}`;
            const filepath = path.join(os.tmpdir(), imageFilename);
            imageToBeUploaded = {filepath, mimetype};
            file.pipe(fs.createWriteStream(filepath));
            return;
        }
    });

    if (imageToBeUploaded) {
        busBoy.on('finish', async () => {
            try {
                await admin.storage()
                    .bucket()
                    .upload(imageToBeUploaded.filepath, {
                        resumable: true,
                        metadata: {
                            contentType: imageToBeUploaded.mimetype
                        }
                    });
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFilename}?alt=media`;
            
                await db.collection(Collection.users)
                    .doc(req.user?.handle || '')
                    .update({
                        imageUrl
                    } as Partial<User>);

                return res.status(200).json({message: 'Image upload successfully'});
            } catch (e) {
                functions.logger.error(e);
                return res.status(500).json({error: {code: 500, message: e.message}});
            }
        });
    }

    busBoy.end(req.body);
};


export const addUserDetails: RequestHandler = async (req: Request, res) => {
    const userDetails: Partial<UserDetail> = reduceUserDetails(req.body);
    try {
        await db.collection(Collection.users)
        .doc(req.user?.handle!)
        .update(userDetails);
        return res.status(200).json({message: 'Details added successfully'});
    } catch (e) {
        return res.status(500).json({error: {code: e.code, message: e.message}});
    }
    
};

// Get own user details
export const getAuthenticatedUser: RequestHandler = async (req: Request, res) => {
    const userData: {credentials?: Omit<User, "id">; likes?: any[]} = {};

    try {
        const doc = await db.collection(Collection.users)
            .doc(req.user?.handle!)
            .get();
        if (doc.exists) {
            userData.credentials = doc.data() as Omit<User, "id">;
            const docs = await db.collection(Collection.likes)
                .where('userHandle', '==', req.user?.handle)
                .get();
            userData.likes = docs.docs.map((snap) => snap.data());
        }
        return res.status(200).json(userData);
    } catch (e) {
        return res.status(500).json({error: {code: e.code, message: e.message}});
    }
}