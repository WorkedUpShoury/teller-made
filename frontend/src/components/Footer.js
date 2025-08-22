import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  return (
    <footer className="py-5" style={{ backgroundColor: 'black', color: 'white' }}>
      <Container>
        <Row>
          <Col md={6}>
            <h4 className="fw-bold mb-4">TellerMade</h4>
            <p className="mb-4">
              AI-powered resume optimization platform helping job seekers land their dream jobs with precision and confidence.
            </p>
          </Col>
          <Col md={6}>
            <div className="d-flex justify-content-md-end gap-4">
              <div>
                <h5 className="fw-bold mb-3">Legal</h5>
                <ul className="list-unstyled">
                  <li className="mb-2">Privacy Policy</li>
                  <li className="mb-2">Terms of Service</li>
                  <li>Contact Us</li>
                </ul>
              </div>
              <div>
                <h5 className="fw-bold mb-3">Follow Us</h5>
                <ul className="list-unstyled">
                  <li className="mb-2">Twitter</li>
                  <li className="mb-2">LinkedIn</li>
                  <li>Instagram</li>
                </ul>
              </div>
            </div>
          </Col>
        </Row>
        <Row className="mt-4 pt-4 border-top border-secondary">
          <Col>
            <p className="mb-0 text-center text-muted" >
              Copyright © 2025 TellerMade. All rights reserved.
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;