import React, {TextInput} from 'react-native';

const INITIAL_INPUT_HEIGHT = 36;
const DEFAULT_FONT_SIZE = 16;

export default class MultilineInput extends React.Component {
  constructor() {
    super();
    this.state = {
      inputHeight: INITIAL_INPUT_HEIGHT
    };
  }

  componentWillReceiveProps(newProps) {
    if ('value' in newProps && !newProps.value) {
      this.setState({inputHeight: INITIAL_INPUT_HEIGHT});
    }
  }

  onChange(e) {
    this.setState({inputHeight: e.nativeEvent.contentSize.height});
  }

  render() {
    const {style, ...other} = this.props;

    return <TextInput {...other}
                      multiline={true}
                      onChange={(e) => this.onChange(e)}
                      style={[{fontSize: DEFAULT_FONT_SIZE}, style, {height: this.state.inputHeight}]}/>
  }
}