import noop from 'lodash/noop';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Modal from 'app/components/Modal';
import i18n from 'app/lib/i18n';
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_LARGE,
  FONT_SIZE_MEDIUM,
  FONT_SIZE_SMALL
} from './constants';

class Settings extends PureComponent {
    static propTypes = {
      fontSize: PropTypes.string,
      onSave: PropTypes.func,
      onCancel: PropTypes.func
    };

    static defaultProps = {
      fontSize: DEFAULT_FONT_SIZE,
      onSave: noop,
      onCancel: noop
    };

    state = {
      fontSize: this.props.fontSize
    };

    handleChangeFontSize = (event) => {
      this.setState({ fontSize: event.target.value });
    };

    handleSave = () => {
      this.props.onSave({ fontSize: this.state.fontSize });
    };

    handleCancel = () => {
      this.props.onCancel();
    };

    render() {
      const { fontSize } = this.state;

      return (
        <Modal disableOverlay size="sm" onClose={this.handleCancel}>
          <Modal.Header>
            <Modal.Title>{i18n._('Console Settings')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="form-group">
              <label><strong>{i18n._('Font Size')}</strong></label>
              <select
                className="form-control"
                value={fontSize}
                onChange={this.handleChangeFontSize}
              >
                <option value={FONT_SIZE_LARGE}>{i18n._('Large')}</option>
                <option value={FONT_SIZE_MEDIUM}>{i18n._('Medium')}</option>
                <option value={FONT_SIZE_SMALL}>{i18n._('Small')}</option>
              </select>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-default" onClick={this.handleCancel}>
              {i18n._('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={this.handleSave}>
              {i18n._('Save Changes')}
            </button>
          </Modal.Footer>
        </Modal>
      );
    }
}

export default Settings;
