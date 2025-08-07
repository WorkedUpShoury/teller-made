import React, { useState } from 'react';
import { Container, Form, Button, Card } from 'react-bootstrap';

const ChatAssistant = () => {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newChat = [...chat, { type: 'user', text: input }];
    setChat(newChat);
    setInput('');

    // ✅ MOCK REPLY: Simulate AI response
    setTimeout(() => {
      setChat([...newChat, { type: 'assistant', text: '🤖 Mock AI reply: Hello! How can I help?' }]);
    }, 500);
  };

  return (
    <Container className="py-5" style={{ maxWidth: '700px' }}>
      <h2 className="mb-4 text-center">🤖 AI Chat Assistant</h2>
      <Card className="p-3 mb-3" style={{ height: '400px', overflowY: 'auto' }}>
        {chat.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-2 p-2 rounded ${msg.type === 'user' ? 'bg-primary text-white text-end' : 'bg-light text-start'}`}
          >
            {msg.text}
          </div>
        ))}
      </Card>
      <Form onSubmit={(e) => e.preventDefault()}>
        <Form.Group className="d-flex">
          <Form.Control
            type="text"
            placeholder="Ask your resume assistant..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button variant="primary" onClick={handleSend} className="ms-2">
            Send
          </Button>
        </Form.Group>
      </Form>
    </Container>
  );
};

export default ChatAssistant;
