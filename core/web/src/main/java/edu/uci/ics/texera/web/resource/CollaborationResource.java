package edu.uci.ics.texera.web.resource;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import javax.websocket.server.ServerEndpointConfig;
import java.io.IOException;
import java.util.*;


@ServerEndpoint("/automerge")
public class CollaborationResource {
    public static HashMap<String, Session> websocketSessionMap = new HashMap<>();

    public static String lockHolder = "";

    // Stores state of automerge
    public static String automergeInitial = "";

    @OnOpen
    public void myOnOpen(final Session session) throws IOException {
        websocketSessionMap.put(session.getId(), session);
    }

    @OnMessage
    public void myOnMsg(final Session session, String message) {

        message = message.substring(1, message.length() - 1);
        // Two different things if current automergeObject is sent 
        String temp1 = "{\"response\": \"" + message + "\"}";
        String temp = "{" + message + "}";
        System.out.println(temp);
        for(String key: websocketSessionMap.keySet()) {
            // only send to other sessions, not the session that send the message?
            Session sess = websocketSessionMap.get(key);
                if (sess != session) {
                    websocketSessionMap.get(key).getAsyncRemote().sendText(temp);
                }       
            }
    }


    // Trying out a lock feature
    public void changeLock(Session newSession) {
        // Client is incapable fo changing if lock is currently claimed
        System.out.println(newSession.getId());
        System.out.println(lockHolder);
        System.out.println("Size: " + websocketSessionMap.size());
        if (lockHolder == "") {
            String temp = "{\"lockStatus\": true}";
            newSession.getAsyncRemote().sendText(temp);
            lockHolder = newSession.getId();
            System.out.println("SETTING LOCK");
        } else if (newSession.getId().equals(lockHolder)) {
            String temp = "{\"lockStatus\": false}";
            newSession.getAsyncRemote().sendText(temp);
            this.releaseLock();
            System.out.println("RESETTING LOCK");
        } else {
            String temp = "{\"lockStatus\": false}";
            newSession.getAsyncRemote().sendText(temp);
            System.out.println("LOCK ALREADY SET");
        }
    }

    public void releaseLock() {
        lockHolder = "";
    }

    @OnClose
    public void myOnClose(final Session session, CloseReason cr) {
        websocketSessionMap.remove(session.getId());
        System.out.println("Session disconnected");
        if (this.lockHolder.equals(session.getId())) {
            this.releaseLock();
        }
        if (websocketSessionMap.isEmpty()) {
            automergeInitial = "";
        }
    }
}