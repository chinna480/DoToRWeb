if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "C:/Users/Gorlagutta Ganesh/.gradle/caches/8.14.3/transforms/1d9b33ce555da17de0d2d1933ef9bfa3/transformed/fbjni-0.7.0/prefab/modules/fbjni/libs/android.arm64-v8a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Gorlagutta Ganesh/.gradle/caches/8.14.3/transforms/1d9b33ce555da17de0d2d1933ef9bfa3/transformed/fbjni-0.7.0/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

