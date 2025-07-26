import BeatLoader from "react-spinners/BeatLoader";

export default function Loader() {
  return (
    <BeatLoader
      // Transform BeatLoader to be better centered in buttons
      cssOverride={{ transform: "translateY(2.5px)" }}
      color="#fff"
      size={10}
      // loading === true as component is functionally rendered
      loading={true}
    />
  );
}
