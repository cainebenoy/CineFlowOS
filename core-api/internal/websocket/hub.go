package websocket

import (
	"log"
)

// Message holds the broadcast payload and the target project room
type Message struct {
	ProjectID string
	Payload   []byte
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients map[project_id]map[*Client]bool
	rooms map[string]map[*Client]bool

	// Inbound messages from the clients or server to be broadcasted to a room
	broadcast chan *Message

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan *Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	log.Println("WebSocket Hub starting...")
	for {
		select {
		case client := <-h.register:
			if h.rooms[client.ProjectID] == nil {
				h.rooms[client.ProjectID] = make(map[*Client]bool)
			}
			h.rooms[client.ProjectID][client] = true
			log.Printf("Client registered to project %s. Total in room: %d\n", client.ProjectID, len(h.rooms[client.ProjectID]))

		case client := <-h.unregister:
			if room, ok := h.rooms[client.ProjectID]; ok {
				if _, ok := room[client]; ok {
					delete(room, client)
					close(client.send)
					log.Printf("Client unregistered from project %s. Total in room: %d\n", client.ProjectID, len(room))
					if len(room) == 0 {
						delete(h.rooms, client.ProjectID)
					}
				}
			}

		case message := <-h.broadcast:
			if room, ok := h.rooms[message.ProjectID]; ok {
				for client := range room {
					select {
					case client.send <- message.Payload:
					default:
						// If send buffer is full, disconnect client
						close(client.send)
						delete(room, client)
					}
				}
			}
		}
	}
}

// BroadcastToProject provides a thread-safe way for HTTP handlers to push messages
func (h *Hub) BroadcastToProject(projectID string, payload []byte) {
	h.broadcast <- &Message{
		ProjectID: projectID,
		Payload:   payload,
	}
}
