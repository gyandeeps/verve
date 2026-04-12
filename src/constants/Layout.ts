import { Dimensions } from "react-native";

const width = Dimensions.get("window").width;

export default {
  borderRadius: 10,
  horizontalPadding: 20,
  isTablet: width >= 768,
};
