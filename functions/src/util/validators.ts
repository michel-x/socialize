import { UserDetail } from "../types";


export const reduceUserDetails = (data: UserDetail) => {
    const userDetails: Partial<UserDetail> = {};
    
    if (data.bio.trim()) userDetails.bio = data.bio;
    if (data.website.trim()) {
        if (data.website.trim().substring(0, 4) !== 'http') {
            userDetails.website = `http://${data.website.trim()}`;
        } else {
            userDetails.website = data.website;
        }
    }
    if (data.location.trim()) userDetails.location = data.location;

    return userDetails;
};