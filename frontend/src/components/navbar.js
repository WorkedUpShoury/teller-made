import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import logo from '../styles/logo.png';
import '../styles/Navbar.css';

function AppNavbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
    window.location.reload(); // refresh navbar state
  };

  return (
    <Navbar expand="lg" className="shadow-sm navbar-custom">
      <div className="ru-bokeh" aria-hidden>
        <span className="b1" />
        <span className="b2" />
      </div>
      <Container>
        <Navbar.Brand as={Link} to="/">
          <img
            src={logo}
            alt="TellerMade Logo"
            className="brand-logo d-inline-block align-top"
          />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-navbar" />
        <Navbar.Collapse id="main-navbar">
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/">Home</Nav.Link>
            <Nav.Link as={Link} to="/upload">Resume</Nav.Link>
            <Nav.Link as={Link} to="/chat-assistant">AI Assist</Nav.Link>
            <Nav.Link as={Link} to="/smart-editor">Editor</Nav.Link>

            {user ? (
              <NavDropdown
                title={
                  <span className="d-flex align-items-center">
                    <img
                      src={user.img_url}
                      alt="Profile"
                      className="rounded-circle me-2"
                      style={{
                        width: "30px",
                        height: "30px",
                        objectFit: "cover",
                        border: "1px solid #ddd"
                      }}
                    />
                    {user.full_name}
                  </span>
                }
                id="account-dropdown"
              >
                <NavDropdown.Item as={Link} to = "/profile">Profile</NavDropdown.Item> 
                <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
              </NavDropdown>
            ) : (
              <NavDropdown title="Account" id="account-dropdown">
                <NavDropdown.Item as={Link} to="/login">Login</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/register">Register</NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;
