import React, { useState } from 'react';
import { Modal, Tab, Tabs, Form, Button, Alert } from 'react-bootstrap';
import { 
  FaTimes, 
  FaSignInAlt, 
  FaUserPlus, 
  FaEnvelope, 
  FaLock, 
  FaUser,
  FaPhone 
} from 'react-icons/fa';

const Auth = ({ show, handleClose }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    login: { email: '', password: '' },
    register: { name: '', email: '', phone: '', password: '', confirmPassword: '' }
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (formType, e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [formType]: {
        ...prev[formType],
        [name]: value
      }
    }));
  };

  const validateForm = (formType) => {
    const newErrors = {};
    const data = formData[formType];

    if (formType === 'login') {
      if (!data.email) newErrors.email = 'Email is required';
      if (!data.password) newErrors.password = 'Password is required';
    } else {
      if (!data.name) newErrors.name = 'Name is required';
      if (!data.email) newErrors.email = 'Email is required';
      if (!data.password) newErrors.password = 'Password is required';
      if (data.password !== data.confirmPassword) {
        newErrors.confirmPassword = 'Passwords must match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateForm('login')) return;
    
    setIsSubmitting(true);
    try {
      // Replace with actual login API call
      console.log('Logging in:', formData.login);
      // On success:
      handleClose();
    } catch (error) {
      setErrors({ api: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm('register')) return;
    
    setIsSubmitting(true);
    try {
      // Replace with actual registration API call
      console.log('Registering:', formData.register);
      // On success:
      setActiveTab('login');
      setFormData(prev => ({
        ...prev,
        login: {
          ...prev.login,
          email: formData.register.email,
          password: ''
        }
      }));
      setErrors({});
    } catch (error) {
      setErrors({ api: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="auth-modal">
      <Modal.Header closeButton>
        <Modal.Title className="w-100 text-center">
          <Tabs
            activeKey={activeTab}
            onSelect={setActiveTab}
            className="w-100 justify-content-center border-0"
          >
            <Tab eventKey="login" title={
              <span className="d-flex align-items-center">
                <FaSignInAlt className="me-2" />
                Login
              </span>
            } />
            <Tab eventKey="register" title={
              <span className="d-flex align-items-center">
                <FaUserPlus className="me-2" />
                Register
              </span>
            } />
          </Tabs>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {errors.api && <Alert variant="danger">{errors.api}</Alert>}

        {activeTab === 'login' ? (
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaEnvelope /></span>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.login.email}
                  onChange={(e) => handleChange('login', e)}
                  isInvalid={!!errors.email}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.email}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaLock /></span>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.login.password}
                  onChange={(e) => handleChange('login', e)}
                  isInvalid={!!errors.password}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.password}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Button 
              variant="primary" 
              type="submit" 
              className="w-100"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>

          
    <div className="text-center mt-3">
      <p className="text-muted">
        New to TellerMade?{' '}
        <Button 
          variant="link" 
          onClick={() => setActiveTab('register')}
          style={{
            color: 'var(--primary-color)',
            padding: 0,
            textDecoration: 'none'
          }}
        >
          Register
        </Button>
      </p>
    </div>



          </Form>
        ) : (
          <Form onSubmit={handleRegister}>
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaUser /></span>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.register.name}
                  onChange={(e) => handleChange('register', e)}
                  isInvalid={!!errors.name}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.name}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaEnvelope /></span>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.register.email}
                  onChange={(e) => handleChange('register', e)}
                  isInvalid={!!errors.email}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.email}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaPhone /></span>
                <Form.Control
                  type="tel"
                  name="phone"
                  value={formData.register.phone}
                  onChange={(e) => handleChange('register', e)}
                />
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaLock /></span>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.register.password}
                  onChange={(e) => handleChange('register', e)}
                  isInvalid={!!errors.password}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.password}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Confirm Password</Form.Label>
              <div className="input-group">
                <span className="input-group-text"><FaLock /></span>
                <Form.Control
                  type="password"
                  name="confirmPassword"
                  value={formData.register.confirmPassword}
                  onChange={(e) => handleChange('register', e)}
                  isInvalid={!!errors.confirmPassword}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.confirmPassword}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Button 
              variant="primary" 
              type="submit" 
              className="w-100"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Register'}
            </Button>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default Auth;