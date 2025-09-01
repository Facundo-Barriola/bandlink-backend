import {sendConnectionRequest, acceptConnectionRequest, 
    rejectConnectionRequest, archiveConnection, deleteConnection, 
    listIncomingPending, listOutgoingPending,
    listAccepted, listArchived} from '../repositories/network.repository.js';

export class NetworkService {

    static async sendConnectionRequest(requesterId: number, targetId: number) {
        return await sendConnectionRequest(requesterId, targetId);
    }

    static async acceptConnectionRequest(actorUserId: number, idConnection: number) {
        return await acceptConnectionRequest(actorUserId, idConnection);
    }

    static async rejectConnectionRequest(actorUserId: number, idConnection: number) {
        return await rejectConnectionRequest(actorUserId, idConnection);
    }

    static async archiveConnection(actorUserId: number, idConnection: number, archived: boolean) {
        return await archiveConnection(actorUserId, idConnection, archived);
    }

    static async deleteConnection(actorUserId: number, idConnection: number) {
        return await deleteConnection(actorUserId, idConnection);
    }

    static async listIncomingPending(idUser: number) {
        return await listIncomingPending(idUser);
    }

    static async listOutgoingPendings(idUser: number) {
        return await listOutgoingPending(idUser);
    }

    static async listAccepted(idUser : number){
        return await listAccepted(idUser);
    }

    static async listArchived(idUser : number){
        return await listArchived(idUser);
    }
}