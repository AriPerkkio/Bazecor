// -*- mode: js-jsx -*-
/* Bazecor -- Kaleidoscope Command Center
 * Copyright (C) 2018, 2019  Keyboardio, Inc.
 * Copyright (C) 2019  DygmaLab SE
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React, { Component, Fragment } from 'react';
import Styled from 'styled-components';
import { toast } from 'react-toastify';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import Dropdown from 'react-bootstrap/Dropdown';

import { MdKeyboard } from 'react-icons/md';

import Focus from '../../api/focus';
import Hardware from '../../api/hardware';

import i18n from '../i18n';

const { remote } = require('electron');

const usb = remote.require('usb');

const Styles = Styled.div`
.keyboard-select {
  .keyboard-row {
    justify-content: center;
    align-items: center;
    display: flex;
    padding-top: 15vh;
    .keyboard-col {
      min-width: 500px;
      max-width: 500px;

      .keyboard-card {
        background: transparent;
        border: none;
        box-shadow: none;
        .loader {
          align-self: center;
          .spinner-border {
            width: 4rem;
            height: 4rem;
          }
        }
        .preview {
          justify-content: center;
          align-items: center;
          display: flex;
          padding: 0px;

          .keyboard {
            justify-content: center;
            align-items: center;
            display: flex;
            svg {
              width: 80%;
              margin-bottom: 10px;
            }
          }
          .options {
            text-align: center;
            .selector {
              width: 100%;
              .dropdown-toggle::after{
                position: absolute;
                right: 10px;
                top: 30px;
              }
              .toggler {
                width: 100%;
                background-color: transparent;
                color: black;
                border: 0;
                border-bottom: black 1px solid;
                border-radius: 0px;
                padding-bottom: 6px;
                :hover {
                  background-color: transparent;
                }
              }
              .toggler:hover {
                border-bottom: black 2px solid;
                padding-bottom: 5px;
              }
              .toggler:focus {
                border-bottom: rgba($color: red, $alpha: 0.8) 2px solid;
                box-shadow: none;
              }
              .menu {
                width: inherit;
                justify-content: center;
                align-items: center;
                text-align: center;
              }
              .key-icon {
                background-color: rgba(255,0,0,0.8) !important;
                border-radius: 100%;
                padding: 0;
                max-width: 50px;
                height: 50px;
                svg {
                  font-size: 2.1em;
                  margin-top: 18%;
                  width: 100%;
                  color: white;
                }
              }
              .key-text {
                span {
                  width: 100%;
                }
              }
              .muted {
                color: rgba(140,140,140,0.8) !important;
              }
              a:hover {
                background-color: rgba(255,0,0,0.3) !important;
              }
              .dropdown-item {
                display: inherit;
              }
            }
            .selector-error {
              color: $danger-color;
            }
          }
        }
      }
        .buttons {
          padding: 0px;
          button {
            width: 100%;
          }
        }
    }
  }
}
`;

class KeyboardSelect extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPortIndex: 0,
      opening: false,
      devices: null,
      loading: false,
      dropdownOpen: false,
    };

    this.onKeyboardConnect = this.onKeyboardConnect.bind(this);
  }

  componentDidMount() {
    this.finder = () => {
      this.findKeyboards();
    };
    usb.on('attach', this.finder);
    usb.on('detach', this.finder);

    this.findKeyboards()
      .then(() => {
        const focus = new Focus();
        if (!focus._port) return;

        for (const device of this.state.devices) {
          if (!device.path) continue;
          if (device.path === focus._port.path) {
            this.setState((state) => ({
              selectedPortIndex: state.devices.indexOf(device),
            }));
            break;
          }
        }
      })
      .catch((error) => {
        console.log(error.toString());
      });
  }

  componentWillUnmount() {
    usb.off('attach', this.finder);
    usb.off('detach', this.finder);
  }

  findNonSerialKeyboards = (deviceList) => {
    const devices = usb
      .getDeviceList()
      .map((device) => device.deviceDescriptor);
    devices.forEach((desc) => {
      Hardware.nonSerial.forEach((device) => {
        if (
          desc.idVendor === device.usb.vendorId &&
          desc.idProduct === device.usb.productId
        ) {
          let found = false;
          deviceList.forEach((sDevice) => {
            if (
              sDevice.device.usb.vendorId === desc.idVendor &&
              sDevice.device.usb.productId === desc.idProduct
            ) {
              found = true;
            }
          });
          if (!found) deviceList.push({ device });
        }
      });
    });
    return deviceList;
  };

  findKeyboards = async () => {
    this.setState({ loading: true });
    const focus = new Focus();

    return new Promise((resolve) => {
      focus
        .find(...Hardware.serial)
        .then(async (devices) => {
          const supportedDevices = [];
          for (const device of devices) {
            device.accessible = await focus.isDeviceAccessible(device);
            if (device.accessible && (await focus.isDeviceSupported(device))) {
              supportedDevices.push(device);
            } else if (!device.accessible) {
              supportedDevices.push(device);
            }
          }
          const list = this.findNonSerialKeyboards(supportedDevices);
          this.setState({
            loading: false,
            devices: list,
          });
          resolve(list.length > 0);
        })
        .catch(() => {
          const list = this.findNonSerialKeyboards([]);
          this.setState({
            loading: false,
            devices: list,
          });
          resolve(list.length > 0);
        });
    });
  };

  scanDevices = async () => {
    const found = await this.findKeyboards();
    this.setState({ scanFoundDevices: found });
    setTimeout(() => {
      this.setState({ scanFoundDevices: undefined });
    }, 1000);
  };

  selectPort = (event) => {
    this.setState({ selectedPortIndex: event.target.value });
  };

  onKeyboardConnect = async () => {
    this.setState({ opening: true });
    const { onConnect } = this.props;

    const { devices, selectedPortIndex } = this.state;

    try {
      await onConnect(devices[selectedPortIndex]);
    } catch (err) {
      this.setState({
        opening: false,
      });
      toast.error(err.toString(), {
        position: toast.POSITION.TOP_LEFT,
      });
    }

    i18n.refreshHardware(devices[selectedPortIndex]);
  };

  render() {
    const {
      scanFoundDevices,
      devices,
      loading,
      selectedPortIndex,
      opening,
      dropdownOpen,
    } = this.state;

    const { onDisconnect } = this.props;

    let deviceItems = null;
    let port = null;
    if (devices && devices.length > 0) {
      deviceItems = devices.map((option, index) => {
        let label = option.path;
        if (option.device && option.device.info) {
          label = (
            <Col xs="10" className="key-text">
              <Col>
                <span>{option.device.info.displayName}</span>
              </Col>
              <Col>
                <span className="muted">
                  {option.path || i18n.keyboardSelect.unknown}
                </span>
              </Col>
            </Col>
          );
        } else if (option.info) {
          label = (
            <Col xs="10" className="key-text">
              <Col>
                <span>{option.device.info.displayName}</span>
              </Col>
              <Col>
                <span className="muted" />
              </Col>
            </Col>
          );
        }

        return (
          <Dropdown.Item key={`${option}`} value={index}>
            <Row>
              <Col xs="2" className="key-icon">
                <MdKeyboard />
              </Col>
              {label}
            </Row>
          </Dropdown.Item>
        );
      });
      const title = devices.map((option) => {
        let label = option.path;
        if (option.device && option.device.info) {
          label = (
            <Col xs="12" className="key-text">
              <Col>
                <span>{option.device.info.displayName}</span>
              </Col>
              <Col>
                <span className="muted">
                  {option.path || i18n.keyboardSelect.unknown}
                </span>
              </Col>
            </Col>
          );
        } else if (option.info) {
          label = (
            <Col xs="12" className="key-text">
              <Col>
                <span>{option.device.info.displayName}</span>
              </Col>
              <Col>
                <span className="muted" />
              </Col>
            </Col>
          );
        }

        return <Row key={`key-${option}`}>{label}</Row>;
      });

      port = (
        <Dropdown
          className="selector"
          isOpen={dropdownOpen}
          toggle={() =>
            this.setState((state) => {
              return { dropdownOpen: state.dropdownOpen };
            })
          }
        >
          <Dropdown.Toggle className="toggler" caret>
            {title[0]}
          </Dropdown.Toggle>
          <Dropdown.Menu className="menu">{deviceItems}</Dropdown.Menu>
        </Dropdown>
      );
    }

    if (devices && devices.length === 0) {
      port = (
        <span className="selector-error">{i18n.keyboardSelect.noDevices}</span>
      );
    }

    let connectContent = i18n.keyboardSelect.connect;
    if (opening) {
      connectContent = <circularProgress color="secondary" size={16} />;
    }

    const scanDevicesButton = (
      <Button
        color={devices && devices.length ? 'secondary' : 'primary'}
        className={scanFoundDevices ? 'scan-button' : 'scan-button'}
        onClick={scanFoundDevices ? null : this.scanDevices}
      >
        {i18n.keyboardSelect.scan}
      </Button>
    );

    let connectionButton;
    let permissionWarning;
    const focus = new Focus();
    const selectedDevice = devices && devices[selectedPortIndex];

    if (selectedDevice && !selectedDevice.accessible) {
      permissionWarning = (
        <span className="selector-error">
          {i18n.keyboardSelect.permissionError}
        </span>
      );
    }

    if (
      focus.device &&
      selectedDevice &&
      selectedDevice.device === focus.device
    ) {
      connectionButton = (
        <Button
          disabled={opening || (devices && devices.length === 0)}
          color="secondary"
          onClick={onDisconnect}
        >
          {i18n.keyboardSelect.disconnect}
        </Button>
      );
    } else {
      connectionButton = (
        <Button
          disabled={
            (selectedDevice ? !selectedDevice.accessible : false) ||
            opening ||
            (devices && devices.length === 0)
          }
          color="primary"
          onClick={this.onKeyboardConnect}
          className=""
        >
          {connectContent}
        </Button>
      );
    }

    let preview;
    if (
      devices &&
      devices[selectedPortIndex] &&
      devices[selectedPortIndex].device &&
      devices[selectedPortIndex].device.components
    ) {
      const Keymap = devices[selectedPortIndex].device.components.keymap;
      preview = <Keymap index={0} className="" />;
    }

    return (
      <Styles>
        <Container fluid className="keyboard-select">
          <Row className="title-row">
            <h4 className="section-title">Keyboard Selection</h4>
          </Row>
          <Row className="keyboard-row">
            <Col xs="4" className="keyboard-col">
              <Card className="keyboard-card">
                {loading ? (
                  <Card.Body className="loader">
                    <Spinner
                      className="spinner-border text-danger"
                      role="status"
                    />
                  </Card.Body>
                ) : (
                  <>
                    <Card.Body className="preview">
                      <Container>
                        <Row>
                          <Col xs="12" className="keyboard">
                            {preview}
                          </Col>
                        </Row>
                        <Row>
                          <Col xs="12" className="options">
                            {port}
                          </Col>
                        </Row>
                        {permissionWarning}
                      </Container>
                    </Card.Body>
                    <br />
                    <Card.Body className="buttons">
                      <Row className="justify-content-center">
                        <Col xs="6">{scanDevicesButton}</Col>
                        <Col xs="6">{connectionButton}</Col>
                      </Row>
                    </Card.Body>
                  </>
                )}
              </Card>
            </Col>
          </Row>
        </Container>
      </Styles>
    );
  }
}

export default KeyboardSelect;
