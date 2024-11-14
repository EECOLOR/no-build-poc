export default {
  client: {
    testValue: 'green'
  },

  auth: {
    noAuth: {
      'web': {
        'client_id': '',
        'auth_uri': 'http://localhost:8000/admin/api/auth/oauth2/authorize',
        'token_uri': '',
        'client_secret': '',

        'scope': '',
        'redirect_uri': '',

        withPublicKeys: f => f({
          'publicKey':
            '-----BEGIN RSA PUBLIC KEY-----\n' +
            'MIIBCgKCAQEA1BRx8awwmBsxHuEs2oYSjftCVq/tpDQr3pw1Dda00N/3gWxkD8Jf\n' +
            'V64GWYb1CDzNaX92gspsDL53+h2q0ZbhO4WJVpOlOIoNBkaiJCD4WSA/6NJ89JxH\n' +
            '8CKYccCC6YclT8f3ZKJSP6/89Tf0//H1Oea9lKWemil5jghk4k8DmoB+kX2ffu1q\n' +
            'iip9uFFHsBapNpDOXIX5n6tix2j9ggpFkY5E9uUHeQWkxphZq1zWNnjwdo/FGAwx\n' +
            'jPAIO2oARB21R6j3iSFOoIo5KUjCv2IXVuR9IgwQz7LoDnwXvTF+ibhimoKmJmPc\n' +
            'XH1G4V8GIjgDI9kkimmVYGG6+aLdh+mWvwIDAQAB\n' +
            '-----END RSA PUBLIC KEY-----\n'
        }),
      },
      privateKey:
        '-----BEGIN RSA PRIVATE KEY-----\n' +
        'MIIEpQIBAAKCAQEA1BRx8awwmBsxHuEs2oYSjftCVq/tpDQr3pw1Dda00N/3gWxk\n' +
        'D8JfV64GWYb1CDzNaX92gspsDL53+h2q0ZbhO4WJVpOlOIoNBkaiJCD4WSA/6NJ8\n' +
        '9JxH8CKYccCC6YclT8f3ZKJSP6/89Tf0//H1Oea9lKWemil5jghk4k8DmoB+kX2f\n' +
        'fu1qiip9uFFHsBapNpDOXIX5n6tix2j9ggpFkY5E9uUHeQWkxphZq1zWNnjwdo/F\n' +
        'GAwxjPAIO2oARB21R6j3iSFOoIo5KUjCv2IXVuR9IgwQz7LoDnwXvTF+ibhimoKm\n' +
        'JmPcXH1G4V8GIjgDI9kkimmVYGG6+aLdh+mWvwIDAQABAoIBAAJxmTMwM+p6HGb0\n' +
        'hZ2fqt9mSZ2RxGVpJnztBDLRyl6XyL8oiRSiEugskgJ+asdlWqFAaJSu5sTU0wbC\n' +
        'SGwcLCHmnYOuYC/Wbg+oSQkCij9jVD6HYmI32h+waQedMMT7xi3KVOryGzbZp8q0\n' +
        'PNylee5otBQzk7AcvJEAPsKu0hCkggOMW7dIu77Dfh8uS06QJPbx9Eo/7FSM0QjI\n' +
        '/gitZlJnIm/DGLXI+CgAqUFxmCat4sQxrwDKIzUQ3BgQe/+/I1UldwAUuDGtpmNY\n' +
        'w+pzGidvnNCznIwenfDOX91Aoo/LMJtA5XZ05o/llGI1OZbzyPAsIglSxkwnaU5M\n' +
        '0FiC9cECgYEA+10dx1Q2N9U9TJrLO8acCTs0PpwJ/SdwjeXr5oFPbEFNDGHc/7I2\n' +
        'Tp/xCu5cDpWk9ws+Udrpx3ElLI4JYQZ+9LQqfiPkJ+Y5zYDrKX7LhQ9gLUy7w7SI\n' +
        'gMxb89F73Ig3Ya/rnGLBmELZDuSHRzHch1hnDQL8jFA8v8iuKVWXfP8CgYEA1/3W\n' +
        'zLSmAyKReaiZCNpahhMecfbDxSphR3vzH10hHREoz6QMj02OqhAAqLTq/srLdhY/\n' +
        'IkirUHH8+cLDpPtbJttuJw9XYwwttQ1HTiXblC/6pmWx9hMku6NslUXFLT7G++g3\n' +
        'T5dT83zAF0o14uz0Ed9PN6K5CwIeRXkfMt8bJkECgYEA4hOd9OmI2i6wM3YF1H2N\n' +
        'WcAl/Sna0hXm5bklsuwawwL4iWp7mn5u2ciAw5Qet/9fn9I8+uIp4XeiN7CIPvvY\n' +
        's75XeZxOWJR46JxK5cdkxQhPOG8LcbmuDCnBikmfXXomVXYkM0OfW5LEJuDjyuTN\n' +
        's+2OweUtwAVqnhOgkQyqc4ECgYEAxKLDuvl7ab8+0ZM8P2MKpqUhQn91GzrJ9VpS\n' +
        'rGsMinnkvaSMCqqBBzIqZ2zNw8i8EnWOZJfj3wjnVjqKAtkS0v1R+x1sYS/lLL85\n' +
        '+1tb3D0R5AsRSQWEm47ce8lZCSft38g5EqyiMTmRZ6KYDE/Mo7i5Vd0+uVbkWDs8\n' +
        'vAOBpAECgYEAo7qpjxNwMJw4OGwLJzuy5/5Xuh96QcI4LwedLsE8A0ucs/Yr318q\n' +
        'ywLq0jMFxjw9Mjyr0uLQ6wAxySjikh5CQCWIfYAkRu/BYUd2QsaVj33TUjJ8qMhS\n' +
        '76rDKYnRZP2ZhhYynBWVKRS6HG1BPZxRvadXl8epjWiWAN8s+txW0K8=\n' +
        '-----END RSA PRIVATE KEY-----\n'
    }
  }
}
