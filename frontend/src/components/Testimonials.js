import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const testimonials = [
  {
    rating: "★★★★★",
    quote: "TellerMade transformed my job search. I got 3x more interviews after optimizing my resume with their AI.",
    author: "Mohit Kulkarni",
    position: "Software Engineer at EY"
  },
  {
    rating: "★★★★★",
    quote: "The ATS scoring feature is incredibly accurate. I finally understood why my applications weren't getting responses.",
    author: "Arohi Shah",
    position: "Product Manager at IBM"
  },
  {
    rating: "★★★★★",
    quote: "The AI chat assistant helped me identify skills I didn't even know I should highlight. Game-changer!",
    author: "Shruti Marathe",
    position: "Data Scientist at TCS"
  }
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="py-5" style={{ backgroundColor: 'var(--light-color)' }}>
      <Container>
        <h2 className="text-center mb-5 fw-bold" style={{ color: 'var(--dark-color)' }}>What Our Users Say</h2>
        <p className="text-center lead mb-5" style={{ color: 'black' }}>
          Join thousands of successful job seekers
        </p>
        
        <Row className="g-4">
          {testimonials.map((testimonial, index) => (
            <Col md={4} key={index}>
              <div 
                className="p-4 h-100 rounded-3 shadow-sm"
                style={{ backgroundColor: 'white' }}
              >
                <div className="text-warning mb-3">{testimonial.rating}</div>
                <blockquote className="mb-4">
                  <p className="fst-italic" style={{ color: 'var(--dark-color)' }}>"{testimonial.quote}"</p>
                </blockquote>
                <div>
                  <p className="fw-bold mb-1" style={{ color: 'var(--primary-color)' }}>{testimonial.author}</p>
                  <p className="text-muted small">{testimonial.position}</p>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
};

export default Testimonials;